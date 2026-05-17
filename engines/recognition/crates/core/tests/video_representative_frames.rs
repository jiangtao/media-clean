use std::io::Cursor;

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use mc_core::{
    analyze_request_with_time, AssetIdentity, AssetInput, AssetSamples, CoreScanRequest,
    EngineInfo, MediaMetadata, MediaType, ScanSource, SourceKind, SourcePlatform, SourceRef,
    VideoFrameSample,
};

#[test]
fn video_representative_frames_are_aggregated_into_asset_hashes_and_metrics() {
    let request = CoreScanRequest::new(
        fixture_source(),
        EngineInfo::core_default(),
        vec![video_asset(
            "video-frames",
            vec![
                frame_sample(600, solid_png([8, 8, 8, 255])),
                frame_sample(6_000, solid_png([128, 128, 128, 255])),
                frame_sample(11_400, checker_png()),
            ],
        )],
    );

    let session = analyze_request_with_time(request, "2026-05-13T00:01:00.000Z")
        .expect("video analysis succeeds");
    assert!(session.diagnostics.is_empty());
    assert_eq!(session.assets.len(), 1);

    let asset = &session.assets[0];
    assert_eq!(asset.media_type, MediaType::Video);
    assert_eq!(asset.duration, Some(12.0));
    assert_eq!(asset.hashes.content_hash.as_ref().unwrap().len(), 64);
    assert_eq!(asset.hashes.frame_hashes.len(), 3);
    assert_eq!(asset.hashes.perceptual_hash.as_ref().unwrap().len(), 16);
    assert_eq!(asset.hashes.difference_hash.as_ref().unwrap().len(), 16);
    assert_eq!(asset.frame_analyses.len(), 3);
    assert_eq!(asset.frame_analyses[0].timestamp_ms, 600);
    assert!((0.0..=1.0).contains(&asset.metrics.brightness));
    assert!((0.0..=1.0).contains(&asset.metrics.contrast));
    assert!((0.0..=1.0).contains(&asset.metrics.edge_density));
    assert!((0.0..=1.0).contains(&asset.metrics.blur_score));

    let json = serde_json::to_value(&session).expect("session serializes");
    assert!(json["assets"][0].get("frameAnalyses").is_none());
    assert_eq!(
        json["assets"][0]["hashes"]["frameHashes"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
}

#[test]
fn video_without_frames_falls_back_to_metadata_only_diagnostic() {
    let request = CoreScanRequest::new(
        fixture_source(),
        EngineInfo::core_default(),
        vec![video_asset("video-metadata-only", Vec::new())],
    );

    let session = analyze_request_with_time(request, "2026-05-13T00:02:00.000Z")
        .expect("metadata-only video succeeds");
    let asset = &session.assets[0];

    assert_eq!(asset.media_type, MediaType::Video);
    assert_eq!(asset.duration, Some(12.0));
    assert_eq!(asset.hashes.content_hash.as_ref().unwrap().len(), 64);
    assert!(asset.hashes.perceptual_hash.is_none());
    assert!(asset.hashes.difference_hash.is_none());
    assert!(asset.hashes.frame_hashes.is_empty());
    assert_eq!(session.diagnostics[0].code, "video-frame-unavailable");
    assert_eq!(
        session.diagnostics[0].asset_id.as_deref(),
        Some("video-metadata-only")
    );
}

fn fixture_source() -> ScanSource {
    ScanSource {
        kind: SourceKind::Fixture,
        root: "fixtures/core".to_string(),
        platform: SourcePlatform::Fixture,
    }
}

fn video_asset(id: &str, frames: Vec<VideoFrameSample>) -> AssetInput {
    AssetInput {
        identity: AssetIdentity {
            id: id.to_string(),
            uri: format!("file:///fixtures/{id}.mp4"),
            relative_path: Some(format!("{id}.mp4")),
            stable_key: Some(id.to_string()),
        },
        media: MediaMetadata {
            media_type: MediaType::Video,
            mime_type: Some("video/mp4".to_string()),
            extension: Some("mp4".to_string()),
            width: 1920,
            height: 1080,
            duration_ms: Some(12_000),
            file_size: 4_200_000,
            created_at: "2026-05-13T00:00:00.000Z".to_string(),
            modified_at: None,
        },
        source_ref: Some(SourceRef::Bytes {
            bytes: format!("fake-video-bytes:{id}").into_bytes(),
            byte_length: None,
        }),
        samples: AssetSamples {
            primary_image: None,
            thumbnail: None,
            video_frames: frames,
        },
    }
}

fn frame_sample(timestamp_ms: u64, bytes: Vec<u8>) -> VideoFrameSample {
    VideoFrameSample {
        timestamp_ms,
        source_ref: SourceRef::Bytes {
            byte_length: Some(bytes.len() as u64),
            bytes,
        },
        width: Some(32),
        height: Some(32),
        extraction_method: "fixture-frame".to_string(),
    }
}

fn solid_png(color: [u8; 4]) -> Vec<u8> {
    let image = ImageBuffer::from_fn(32, 32, |_x, _y| Rgba(color));
    encode_png(image)
}

fn checker_png() -> Vec<u8> {
    let image = ImageBuffer::from_fn(32, 32, |x, y| {
        let value = if (x + y) % 2 == 0 { 255 } else { 0 };
        Rgba([value, value, value, 255])
    });
    encode_png(image)
}

fn encode_png(image: ImageBuffer<Rgba<u8>, Vec<u8>>) -> Vec<u8> {
    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .expect("png encodes");
    output.into_inner()
}

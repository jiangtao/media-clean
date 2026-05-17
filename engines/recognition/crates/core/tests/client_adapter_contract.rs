use std::io::Cursor;

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use mc_core::{
    analyze_request_with_time, AssetIdentity, AssetInput, AssetSamples, CoreScanRequest,
    EngineInfo, MediaMetadata, MediaType, ScanSource, SourceKind, SourcePlatform, SourceRef,
};

#[test]
fn android_adapter_can_pass_photo_bytes_without_filesystem_access() {
    let bytes = solid_png([18, 24, 32, 255]);
    let request = CoreScanRequest::new(
        android_source(),
        EngineInfo::core_default(),
        vec![AssetInput {
            identity: AssetIdentity {
                id: "android-photo-42".to_string(),
                uri: "content://media/external/images/media/42".to_string(),
                relative_path: None,
                stable_key: Some("mediastore:image:42".to_string()),
            },
            media: MediaMetadata {
                media_type: MediaType::Photo,
                mime_type: Some("image/png".to_string()),
                extension: Some("png".to_string()),
                width: 0,
                height: 0,
                duration_ms: None,
                file_size: bytes.len() as u64,
                created_at: "2026-05-13T00:00:00.000Z".to_string(),
                modified_at: None,
            },
            source_ref: Some(SourceRef::Bytes {
                byte_length: Some(bytes.len() as u64),
                bytes,
            }),
            samples: AssetSamples::default(),
        }],
    );

    let session = analyze_request_with_time(request, "2026-05-13T00:00:01.000Z")
        .expect("android bytes adapter input should analyze");
    let asset = &session.assets[0];

    assert_eq!(session.source.kind, SourceKind::AndroidMediaStore);
    assert_eq!(session.source.platform, SourcePlatform::Android);
    assert_eq!(asset.uri, "content://media/external/images/media/42");
    assert_eq!(asset.media_type, MediaType::Photo);
    assert_eq!(asset.width, 32);
    assert_eq!(asset.height, 32);
    assert!(asset.hashes.content_hash.is_some());
    assert!(asset.hashes.perceptual_hash.is_some());
}

#[test]
fn android_adapter_can_pass_metadata_only_video_without_core_file_access() {
    let request = CoreScanRequest::new(
        android_source(),
        EngineInfo::core_default(),
        vec![AssetInput {
            identity: AssetIdentity {
                id: "android-video-7".to_string(),
                uri: "content://media/external/video/media/7".to_string(),
                relative_path: None,
                stable_key: Some("mediastore:video:7".to_string()),
            },
            media: MediaMetadata {
                media_type: MediaType::Video,
                mime_type: Some("video/mp4".to_string()),
                extension: Some("mp4".to_string()),
                width: 1920,
                height: 1080,
                duration_ms: Some(5_000),
                file_size: 2_048_000,
                created_at: "2026-05-13T00:00:00.000Z".to_string(),
                modified_at: None,
            },
            source_ref: Some(SourceRef::Opaque {
                byte_length: Some(2_048_000),
            }),
            samples: AssetSamples::default(),
        }],
    );

    let session = analyze_request_with_time(request, "2026-05-13T00:00:02.000Z")
        .expect("metadata-only video should remain analyzable");
    let asset = &session.assets[0];

    assert_eq!(asset.uri, "content://media/external/video/media/7");
    assert_eq!(asset.media_type, MediaType::Video);
    assert_eq!(asset.duration, Some(5.0));
    assert!(asset.hashes.content_hash.is_none());
    assert!(asset.hashes.perceptual_hash.is_none());
    assert_eq!(session.diagnostics[0].code, "video-frame-unavailable");
}

fn android_source() -> ScanSource {
    ScanSource {
        kind: SourceKind::AndroidMediaStore,
        root: "content://media/external".to_string(),
        platform: SourcePlatform::Android,
    }
}

fn solid_png(color: [u8; 4]) -> Vec<u8> {
    let image = ImageBuffer::from_fn(32, 32, |_x, _y| Rgba(color));
    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .expect("png encodes");
    output.into_inner()
}

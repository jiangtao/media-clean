use std::collections::BTreeSet;
use std::io::Cursor;

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use mc_core::{
    analyze_request_with_time, AssetIdentity, AssetInput, AssetSamples, CoreScanRequest,
    EngineInfo, MediaMetadata, MediaType, ScanSource, SourceKind, SourcePlatform, SourceRef,
};

#[test]
fn image_analysis_emits_schema_compatible_session_asset() {
    let bytes = gradient_png();
    let request = CoreScanRequest::new(
        ScanSource {
            kind: SourceKind::Fixture,
            root: "fixtures/core".to_string(),
            platform: SourcePlatform::Fixture,
        },
        EngineInfo::core_default(),
        vec![AssetInput {
            identity: AssetIdentity {
                id: "gradient-photo".to_string(),
                uri: "file:///fixtures/gradient-photo.png".to_string(),
                relative_path: Some("gradient-photo.png".to_string()),
                stable_key: Some("gradient-photo".to_string()),
            },
            media: MediaMetadata {
                media_type: MediaType::Photo,
                mime_type: Some("image/png".to_string()),
                extension: Some("png".to_string()),
                width: 0,
                height: 0,
                duration_ms: None,
                file_size: 0,
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

    let session = analyze_request_with_time(request, "2026-05-13T00:00:10.000Z")
        .expect("image analysis succeeds");
    assert_eq!(session.schema_version, "media-clean-result/v0.5");
    assert_eq!(session.assets.len(), 1);

    let asset = &session.assets[0];
    assert_eq!(asset.id, "gradient-photo");
    assert_eq!(asset.media_type, MediaType::Photo);
    assert_eq!(asset.width, 24);
    assert_eq!(asset.height, 24);
    assert_eq!(asset.hashes.content_hash.as_ref().unwrap().len(), 64);
    assert_eq!(asset.hashes.perceptual_hash.as_ref().unwrap().len(), 16);
    assert_eq!(asset.hashes.difference_hash.as_ref().unwrap().len(), 16);
    assert_eq!(asset.hashes.frame_hashes.len(), 1);
    assert!((0.0..=1.0).contains(&asset.metrics.brightness));
    assert!((0.0..=1.0).contains(&asset.metrics.contrast));
    assert!((0.0..=1.0).contains(&asset.metrics.edge_density));
    assert!((0.0..=1.0).contains(&asset.metrics.blur_score));

    let json = serde_json::to_value(&session).expect("session serializes");
    assert_eq!(json["schemaVersion"], "media-clean-result/v0.5");
    assert_eq!(json["engine"]["kind"], "desktop-rust");
    let keys = json["assets"][0]
        .as_object()
        .expect("asset object")
        .keys()
        .cloned()
        .collect::<BTreeSet<_>>();
    assert_eq!(
        keys,
        BTreeSet::from([
            "createdAt".to_string(),
            "duration".to_string(),
            "fileSize".to_string(),
            "hashes".to_string(),
            "height".to_string(),
            "id".to_string(),
            "mediaType".to_string(),
            "metrics".to_string(),
            "uri".to_string(),
            "width".to_string(),
        ])
    );
}

fn gradient_png() -> Vec<u8> {
    let image = ImageBuffer::from_fn(24, 24, |x, y| {
        let red = ((x * 10) % 255) as u8;
        let green = ((y * 10) % 255) as u8;
        let blue = (((x + y) * 5) % 255) as u8;
        Rgba([red, green, blue, 255])
    });
    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .expect("png encodes");
    output.into_inner()
}

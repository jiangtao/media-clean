use std::io::Cursor;

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use mc_core::{
    analyze_request_with_time, AssetIdentity, AssetInput, AssetSamples, ClusterCategory,
    CoreScanRequest, EngineInfo, MediaMetadata, MediaType, ScanSource, SourceKind, SourcePlatform,
    SourceRef,
};

#[test]
fn exact_duplicate_photos_form_duplicate_cluster() {
    let bytes = gradient_png(None);
    let request = request_with_assets(vec![
        photo_asset("duplicate-a", bytes.clone()),
        photo_asset("duplicate-b", bytes),
    ]);

    let session = analyze_request_with_time(request, "2026-05-13T00:03:00.000Z")
        .expect("duplicate analysis succeeds");
    let cluster = session
        .clusters
        .iter()
        .find(|cluster| cluster.category == ClusterCategory::Duplicate)
        .expect("duplicate cluster exists");

    assert_eq!(cluster.asset_ids.len(), 2);
    assert!(cluster.reasons.contains(&"same-content-hash".to_string()));
}

#[test]
fn visually_similar_photos_form_near_similar_cluster() {
    let request = request_with_assets(vec![
        photo_asset("similar-a", gradient_png(None)),
        photo_asset("similar-b", gradient_png(Some((7, 7, [255, 0, 0, 255])))),
    ]);

    let session = analyze_request_with_time(request, "2026-05-13T00:04:00.000Z")
        .expect("near-similar analysis succeeds");
    let cluster = session
        .clusters
        .iter()
        .find(|cluster| cluster.category == ClusterCategory::NearSimilar)
        .expect("near-similar cluster exists");

    assert_eq!(cluster.asset_ids.len(), 2);
    assert_ne!(
        session.assets[0].hashes.content_hash,
        session.assets[1].hashes.content_hash
    );
}

fn request_with_assets(assets: Vec<AssetInput>) -> CoreScanRequest {
    CoreScanRequest::new(
        ScanSource {
            kind: SourceKind::Fixture,
            root: "fixtures/core/similar".to_string(),
            platform: SourcePlatform::Fixture,
        },
        EngineInfo::core_default(),
        assets,
    )
}

fn photo_asset(id: &str, bytes: Vec<u8>) -> AssetInput {
    AssetInput {
        identity: AssetIdentity {
            id: id.to_string(),
            uri: format!("file:///fixtures/{id}.png"),
            relative_path: Some(format!("{id}.png")),
            stable_key: Some(id.to_string()),
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
    }
}

fn gradient_png(mutation: Option<(u32, u32, [u8; 4])>) -> Vec<u8> {
    let mut image = ImageBuffer::from_fn(64, 64, |x, y| {
        let red = ((x * 3 + y) % 255) as u8;
        let green = ((y * 4 + x) % 255) as u8;
        let blue = (((x + y) * 2) % 255) as u8;
        Rgba([red, green, blue, 255])
    });
    if let Some((x, y, color)) = mutation {
        image.put_pixel(x, y, Rgba(color));
    }
    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .expect("png encodes");
    output.into_inner()
}

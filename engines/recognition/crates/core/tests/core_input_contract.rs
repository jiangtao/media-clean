use mc_core::{
    AssetIdentity, AssetInput, AssetSamples, CoreScanRequest, EngineInfo, MediaMetadata, MediaType,
    ScanOptions, ScanSource, SourceKind, SourcePlatform, SourceRef, VideoFramePolicyKind,
    SESSION_SCHEMA_VERSION,
};

#[test]
fn core_input_contract_serializes_standard_adapter_request() {
    let request = CoreScanRequest::new(
        ScanSource {
            kind: SourceKind::Fixture,
            root: "fixtures/core".to_string(),
            platform: SourcePlatform::Fixture,
        },
        EngineInfo::core_default(),
        vec![AssetInput {
            identity: AssetIdentity {
                id: "photo-001".to_string(),
                uri: "file:///fixtures/photo-001.png".to_string(),
                relative_path: Some("photo-001.png".to_string()),
                stable_key: Some("fixture/photo-001.png:128".to_string()),
            },
            media: MediaMetadata {
                media_type: MediaType::Photo,
                mime_type: Some("image/png".to_string()),
                extension: Some("png".to_string()),
                width: 16,
                height: 16,
                duration_ms: None,
                file_size: 128,
                created_at: "2026-05-13T00:00:00.000Z".to_string(),
                modified_at: Some("2026-05-13T00:00:01.000Z".to_string()),
            },
            source_ref: Some(SourceRef::Bytes {
                bytes: vec![1, 2, 3],
                byte_length: Some(3),
            }),
            samples: AssetSamples::default(),
        }],
    );

    assert_eq!(request.schema_version, SESSION_SCHEMA_VERSION);
    assert_eq!(
        request.options.video_frame_policy.kind,
        VideoFramePolicyKind::BoundedRepresentativeFrames
    );

    let value = serde_json::to_value(&request).expect("request serializes");
    assert_eq!(value["source"]["kind"], "fixture");
    assert_eq!(value["source"]["platform"], "fixture");
    assert_eq!(value["engine"]["kind"], "desktop-rust");
    assert_eq!(value["engine"]["algorithmVersion"], "rust-core/v0.5.0");
    assert_eq!(value["options"]["hash"][0], "content");
    assert_eq!(
        value["options"]["videoFramePolicy"]["samplePoints"],
        serde_json::json!([0.05, 0.5, 0.95])
    );
    assert_eq!(value["assets"][0]["sourceRef"]["kind"], "bytes");
}

#[test]
fn scan_options_support_metadata_only_video_policy() {
    let options = ScanOptions {
        video_frame_policy: mc_core::VideoFramePolicy {
            kind: VideoFramePolicyKind::MetadataOnly,
            ..Default::default()
        },
        ..Default::default()
    };

    let value = serde_json::to_value(options).expect("options serializes");
    assert_eq!(value["videoFramePolicy"]["kind"], "metadata-only");
}

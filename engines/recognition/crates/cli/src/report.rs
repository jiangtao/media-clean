use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::model::MediaCleanSession;

pub fn write_report(session: &MediaCleanSession, out_dir: &Path) -> Result<PathBuf> {
    fs::create_dir_all(out_dir)
        .with_context(|| format!("create report directory {}", out_dir.display()))?;
    let index = out_dir.join("index.html");
    fs::write(&index, render_report(session)?)?;
    Ok(index)
}

fn render_report(session: &MediaCleanSession) -> Result<String> {
    let report_data = serde_json::json!({
        "session": session,
        "summary": {
            "assetCount": session.assets.len(),
            "clusterCount": session.clusters.len(),
            "cleanupPlanCount": session.cleanup_plans.len(),
            "diagnosticCount": session.diagnostics.len()
        }
    });
    let injected = escape_script_json(&serde_json::to_string(&report_data)?);
    let report_command = format!(
        "mc report .mc/{}/session.json --open",
        session.session_id
    );

    Ok(report_template()
        .replace("__REPORT_DATA__", &injected)
        .replace("__SESSION_ID__", &html_escape(&session.session_id))
        .replace("__ASSET_COUNT__", &session.assets.len().to_string())
        .replace("__CLUSTER_COUNT__", &session.clusters.len().to_string())
        .replace(
            "__CLEANUP_PLAN_COUNT__",
            &session.cleanup_plans.len().to_string(),
        )
        .replace("__REPORT_COMMAND__", &html_escape(&report_command)))
}

fn report_template() -> &'static str {
    r#"<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Media Clean Report Launcher</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(180deg, #f5f7fb 0%, #eef3fb 100%);
      color: #17213a;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      box-sizing: border-box;
      max-width: 920px;
      margin: 0 auto;
      padding: 48px 24px;
    }
    section {
      background: #fff;
      border: 1px solid #e7edf7;
      border-radius: 8px;
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
      padding: 24px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 0;
    }
    p {
      color: #6d7891;
      line-height: 1.65;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin: 24px 0;
    }
    .metric {
      background: #f2f5fb;
      border-radius: 8px;
      padding: 14px;
    }
    .metric strong {
      display: block;
      color: #17213a;
      font-size: 24px;
    }
    code {
      display: block;
      overflow-x: auto;
      border-radius: 8px;
      background: #0f1728;
      color: #e6ecf7;
      padding: 14px;
      white-space: pre;
    }
    button {
      border: 0;
      border-radius: 8px;
      background: #2f80ff;
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      padding: 10px 14px;
    }
  </style>
</head>
<body>
  <main>
    <section>
      <p>Media Clean · Local Review</p>
      <h1>Report 已生成，推荐用 Next.js 工作台查看</h1>
      <p>当前静态文件只保留兼容和 smoke 信息。完整的分类 tabs、图片/视频 gallery、确认清理和本地回收站桥接，都在 Next.js report workbench 中运行。</p>
      <div class="metrics">
        <div class="metric"><strong>__ASSET_COUNT__</strong><span>Assets</span></div>
        <div class="metric"><strong>__CLUSTER_COUNT__</strong><span>Clusters</span></div>
        <div class="metric"><strong>__CLEANUP_PLAN_COUNT__</strong><span>Cleanup plans</span></div>
      </div>
      <p>正式命令：</p>
      <code id="report-command">__REPORT_COMMAND__</code>
      <p><button type="button" onclick="copyCommand()">复制命令</button></p>
    </section>
  </main>
  <script id="mc-report-data" type="application/json">__REPORT_DATA__</script>
  <script>
    const data = JSON.parse(document.getElementById('mc-report-data').textContent);
    function copyCommand() {
      const command = document.getElementById('report-command').textContent;
      navigator.clipboard?.writeText(command);
    }
  </script>
</body>
</html>
"#
}

fn escape_script_json(value: &str) -> String {
    value
        .replace("</script", "<\\/script")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

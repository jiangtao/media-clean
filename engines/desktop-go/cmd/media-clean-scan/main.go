package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"image"
	"image/color"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

const schemaVersion = "media-clean-result/v0.5"

type resultSession struct {
	SchemaVersion     string             `json:"schemaVersion"`
	SessionID         string             `json:"sessionId"`
	GeneratedAt       string             `json:"generatedAt"`
	Source            resultSource       `json:"source"`
	Engine            resultEngine       `json:"engine"`
	Assets            []resultAsset      `json:"assets"`
	Clusters          []resultCluster    `json:"clusters"`
	LLMReviews        []resultLLMReview  `json:"llmReviews"`
	CleanupPlans      []resultPlan       `json:"cleanupPlans"`
	QuarantineActions []quarantineAction `json:"quarantineActions"`
}

type resultSource struct {
	Kind     string `json:"kind"`
	Root     string `json:"root"`
	Platform string `json:"platform"`
}

type resultEngine struct {
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type resultAsset struct {
	ID        string        `json:"id"`
	URI       string        `json:"uri"`
	MediaType string        `json:"mediaType"`
	Width     int           `json:"width"`
	Height    int           `json:"height"`
	Duration  *float64      `json:"duration"`
	FileSize  int64         `json:"fileSize"`
	CreatedAt string        `json:"createdAt"`
	Metrics   resultMetrics `json:"metrics"`
	Hashes    resultHashes  `json:"hashes"`
}

type resultMetrics struct {
	Brightness  float64 `json:"brightness"`
	Contrast    float64 `json:"contrast"`
	EdgeDensity float64 `json:"edgeDensity"`
	BlurScore   float64 `json:"blurScore"`
}

type resultHashes struct {
	ContentHash    *string  `json:"contentHash"`
	PerceptualHash *string  `json:"perceptualHash"`
	DifferenceHash *string  `json:"differenceHash"`
	FrameHashes    []string `json:"frameHashes"`
}

type resultCluster struct {
	ID                    string   `json:"id"`
	Category              string   `json:"category"`
	AssetIDs              []string `json:"assetIds"`
	RepresentativeAssetID string   `json:"representativeAssetId"`
	Score                 float64  `json:"score"`
	Reasons               []string `json:"reasons"`
}

type resultLLMReview struct {
	ClusterID       string  `json:"clusterId"`
	Provider        string  `json:"provider"`
	Model           string  `json:"model"`
	PromptVersion   string  `json:"promptVersion"`
	Category        string  `json:"category"`
	Confidence      string  `json:"confidence"`
	CleanupReason   string  `json:"cleanupReason"`
	KeepReason      *string `json:"keepReason"`
	Risk            string  `json:"risk"`
	SuggestedAction string  `json:"suggestedAction"`
}

type resultPlan struct {
	ID                   string   `json:"id"`
	ClusterID            string   `json:"clusterId"`
	Action               string   `json:"action"`
	AssetIDs             []string `json:"assetIds"`
	RequiresConfirmation bool     `json:"requiresConfirmation"`
}

type quarantineAction struct {
	PlanID   string   `json:"planId"`
	Mode     string   `json:"mode"`
	Status   string   `json:"status"`
	AssetIDs []string `json:"assetIds"`
}

func main() {
	root := flag.String("root", "", "directory to scan")
	out := flag.String("out", "", "output JSON file")
	sessionID := flag.String("session-id", "desktop-go-spike", "session id")
	flag.Parse()

	if strings.TrimSpace(*root) == "" {
		fatalf("--root is required")
	}
	if strings.TrimSpace(*out) == "" {
		fatalf("--out is required")
	}

	absRoot, err := filepath.Abs(*root)
	if err != nil {
		fatalf("resolve root: %v", err)
	}

	assets, err := scanAssets(absRoot)
	if err != nil {
		fatalf("scan assets: %v", err)
	}

	clusters, plans, actions := buildDryRunPlan(assets)
	session := resultSession{
		SchemaVersion: schemaVersion,
		SessionID:     *sessionID,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339Nano),
		Source: resultSource{
			Kind:     "desktop-filesystem",
			Root:     absRoot,
			Platform: normalizePlatform(runtime.GOOS),
		},
		Engine: resultEngine{
			Kind:    "desktop-go",
			Name:    "media-clean-desktop-go-spike",
			Version: "0.0.1",
		},
		Assets:            assets,
		Clusters:          clusters,
		LLMReviews:        []resultLLMReview{},
		CleanupPlans:      plans,
		QuarantineActions: actions,
	}

	if err := writeJSON(*out, session); err != nil {
		fatalf("write output: %v", err)
	}

	fmt.Printf("desktop-go scan ok: %d assets -> %s\n", len(assets), *out)
}

func scanAssets(root string) ([]resultAsset, error) {
	var paths []string
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		if isSupportedMedia(path) {
			paths = append(paths, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(paths)

	assets := make([]resultAsset, 0, len(paths))
	for _, path := range paths {
		asset, err := analyzeAsset(root, path)
		if err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}
	return assets, nil
}

func analyzeAsset(root string, path string) (resultAsset, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return resultAsset{}, err
	}
	info, err := os.Stat(path)
	if err != nil {
		return resultAsset{}, err
	}

	hash := sha256.Sum256(data)
	contentHash := hex.EncodeToString(hash[:])
	perceptualHash := contentHash[:16]
	differenceHash := contentHash[16:32]
	metrics, width, height := analyzeImage(data)
	relativePath, err := filepath.Rel(root, path)
	if err != nil {
		return resultAsset{}, err
	}

	return resultAsset{
		ID:        stableAssetID(relativePath),
		URI:       fileURI(path),
		MediaType: mediaTypeForPath(path),
		Width:     width,
		Height:    height,
		Duration:  nil,
		FileSize:  info.Size(),
		CreatedAt: info.ModTime().UTC().Format(time.RFC3339Nano),
		Metrics:   metrics,
		Hashes: resultHashes{
			ContentHash:    &contentHash,
			PerceptualHash: &perceptualHash,
			DifferenceHash: &differenceHash,
			FrameHashes:    []string{},
		},
	}, nil
}

func analyzeImage(data []byte) (resultMetrics, int, int) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return resultMetrics{}, 0, 0
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width == 0 || height == 0 {
		return resultMetrics{}, width, height
	}

	step := max(1, max(width, height)/128)
	var count float64
	var sum float64
	var sumSquares float64
	var edgeSum float64
	var edgeCount float64

	for y := bounds.Min.Y; y < bounds.Max.Y; y += step {
		var previous *float64
		for x := bounds.Min.X; x < bounds.Max.X; x += step {
			gray := pixelGray(img.At(x, y))
			count++
			sum += gray
			sumSquares += gray * gray
			if previous != nil {
				edgeSum += math.Abs(gray - *previous)
				edgeCount++
			}
			current := gray
			previous = &current
		}
	}

	brightness := sum / count
	contrast := math.Sqrt(math.Max(0, sumSquares/count-brightness*brightness))
	edgeDensity := 0.0
	if edgeCount > 0 {
		edgeDensity = edgeSum / edgeCount
	}

	return resultMetrics{
		Brightness:  roundMetric(brightness),
		Contrast:    roundMetric(contrast),
		EdgeDensity: roundMetric(edgeDensity),
		BlurScore:   roundMetric(clamp01(1 - edgeDensity*4)),
	}, width, height
}

func buildDryRunPlan(assets []resultAsset) ([]resultCluster, []resultPlan, []quarantineAction) {
	var clusters []resultCluster
	var plans []resultPlan
	var actions []quarantineAction

	for _, asset := range assets {
		reasons := lowValueReasons(asset)
		if len(reasons) == 0 {
			continue
		}
		clusterID := "cluster-" + asset.ID
		planID := "plan-" + asset.ID
		clusters = append(clusters, resultCluster{
			ID:                    clusterID,
			Category:              "low_value",
			AssetIDs:              []string{asset.ID},
			RepresentativeAssetID: asset.ID,
			Score:                 85,
			Reasons:               reasons,
		})
		plans = append(plans, resultPlan{
			ID:                   planID,
			ClusterID:            clusterID,
			Action:               "review",
			AssetIDs:             []string{asset.ID},
			RequiresConfirmation: true,
		})
		actions = append(actions, quarantineAction{
			PlanID:   planID,
			Mode:     "dry-run",
			Status:   "planned",
			AssetIDs: []string{asset.ID},
		})
	}

	return clusters, plans, actions
}

func lowValueReasons(asset resultAsset) []string {
	var reasons []string
	if asset.Width == 0 || asset.Height == 0 {
		reasons = append(reasons, "metadata-unreadable")
	}
	if asset.Metrics.Brightness < 0.08 {
		reasons = append(reasons, "very-dark")
	}
	if asset.Metrics.Contrast < 0.05 {
		reasons = append(reasons, "low-contrast")
	}
	if asset.Metrics.EdgeDensity < 0.01 {
		reasons = append(reasons, "low-edge-density")
	}
	return reasons
}

func writeJSON(out string, session resultSession) error {
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(out, append(data, '\n'), 0o644)
}

func isSupportedMedia(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg", ".png", ".gif":
		return true
	default:
		return false
	}
}

func mediaTypeForPath(path string) string {
	return "photo"
}

func stableAssetID(path string) string {
	normalized := strings.ToLower(filepath.ToSlash(path))
	normalized = strings.Trim(strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, normalized), "-")
	if normalized == "" {
		return "asset"
	}
	return normalized
}

func fileURI(path string) string {
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	return "file://" + filepath.ToSlash(abs)
}

func normalizePlatform(goos string) string {
	switch goos {
	case "darwin":
		return "macos"
	case "windows":
		return "windows"
	case "linux":
		return "linux"
	default:
		return "fixture"
	}
}

func pixelGray(pixel color.Color) float64 {
	r, g, b, _ := pixel.RGBA()
	return (0.2126*float64(r) + 0.7152*float64(g) + 0.0722*float64(b)) / 65535
}

func roundMetric(value float64) float64 {
	return math.Round(clamp01(value)*10000) / 10000
}

func clamp01(value float64) float64 {
	return math.Max(0, math.Min(1, value))
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

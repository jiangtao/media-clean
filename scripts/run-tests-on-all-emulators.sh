#!/bin/bash

# run-tests-on-all-emulators.sh
# Run tests on all 24 configured Android emulators for device compatibility testing
# Based on emulator-config.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/emulator-config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_PACKAGE="com.mistap.cleaner"
TEST_TIMEOUT=300000  # 5 minutes per device
ADB_WAIT_TIMEOUT=60  # seconds to wait for device

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v adb &> /dev/null; then
        log_error "adb not found. Please install Android SDK."
        exit 1
    fi

    if ! command -v avdmanager &> /dev/null; then
        log_error "avdmanager not found. Please install Android SDK."
        exit 1
    fi

    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Get list of app_cleaner emulators
get_emulator_list() {
    avdmanager list avd -c 2>/dev/null | grep "^app_cleaner_" | sort
}

# Start an emulator
start_emulator() {
    local avd_name=$1
    local port=$2

    log_info "Starting emulator: ${avd_name} on port ${port}"

    # Check if already running
    if adb -P ${port} devices 2>/dev/null | grep -q "emulator-${port}"; then
        log_warn "Emulator on port ${port} is already running"
        return 0
    fi

    # Start emulator in background
    emulator -avd "$avd_name" -port ${port} -no-window -no-audio -no-boot-anim -gpu host -skin 1080x2400 &
    local pid=$!

    # Wait for device to boot
    log_info "Waiting for device to boot (timeout: ${ADB_WAIT_TIMEOUT}s)..."
    local counter=0
    while [ $counter -lt $ADB_WAIT_TIMEOUT ]; do
        if adb -P ${port} shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
            log_success "Emulator ${avd_name} booted successfully"
            echo $pid
            return 0
        fi
        sleep 1
        ((counter++))
        if [ $((counter % 10)) -eq 0 ]; then
            log_info "Still waiting for boot... (${counter}s)"
        fi
    done

    log_error "Emulator ${avd_name} failed to boot within ${ADB_WAIT_TIMEOUT}s"
    kill $pid 2>/dev/null || true
    return 1
}

# Stop an emulator
stop_emulator() {
    local port=$1

    log_info "Stopping emulator on port ${port}"

    if adb -P ${port} devices 2>/dev/null | grep -q "emulator-${port}"; then
        adb -P ${port} emu kill 2>/dev/null || true
        sleep 2
    fi
}

# Install app on emulator
install_app() {
    local port=$1
    local apk_path=$2

    log_info "Installing APK on emulator-${port}"

    if [ ! -f "$apk_path" ]; then
        log_error "APK not found: $apk_path"
        return 1
    fi

    if adb -P ${port} install -r "$apk_path" 2>&1 | grep -q "Success"; then
        log_success "App installed successfully"
        return 0
    else
        log_error "App installation failed"
        return 1
    fi
}

# Run instrumentation tests
run_instrumentation_tests() {
    local port=$1
    local avd_name=$2

    log_info "Running instrumentation tests on ${avd_name}"

    # Check if test package exists
    if ! adb -P ${port} shell pm list packages | grep -q "$TEST_PACKAGE"; then
        log_warn "Test package not found, skipping instrumentation tests"
        return 1
    fi

    # Run tests
    local test_output=$(adb -P ${port} shell am instrument -w \
        -e package "$TEST_PACKAGE" \
        "$TEST_PACKAGE.test/androidx.test.runner.AndroidJUnitRunner" 2>&1)

    if echo "$test_output" | grep -q "OK"; then
        log_success "Tests passed on ${avd_name}"
        return 0
    else
        log_error "Tests failed on ${avd_name}"
        echo "$test_output"
        return 1
    fi
}

# Run React Native tests (Detox or similar)
run_rn_tests() {
    local port=$1
    local avd_name=$2

    log_info "Running React Native tests on ${avd_name}"

    # Navigate to project root
    cd "$PROJECT_ROOT"

    # Set ADB port for Detox
    export ANDROID_ADB_SERVER_PORT=${port}

    # Run Detox tests if available
    if [ -f "package.json" ] && grep -q "detox" package.json 2>/dev/null; then
        log_info "Running Detox tests..."
        if npx detox test --configuration android.emu.debug 2>&1 | grep -q "PASS"; then
            log_success "Detox tests passed on ${avd_name}"
            return 0
        else
            log_error "Detox tests failed on ${avd_name}"
            return 1
        fi
    else
        # Fallback to basic ADB logcat check
        log_info "Running basic app launch test..."

        # Start the app
        adb -P ${port} shell am start -n "${TEST_PACKAGE}/.MainActivity" 2>/dev/null || true

        # Wait a moment
        sleep 5

        # Check if app is running
        if adb -P ${port} shell ps | grep -q "$TEST_PACKAGE"; then
            log_success "App launched successfully on ${avd_name}"
            return 0
        else
            log_warn "App may not have started properly on ${avd_name}"
            return 1
        fi
    fi
}

# Run screenshot capture for visual regression
run_screenshot_test() {
    local port=$1
    local avd_name=$2
    local device_name=$3

    log_info "Capturing screenshots on ${avd_name}"

    # Create screenshots directory
    local screenshot_dir="$PROJECT_ROOT/screenshots/${device_name}"
    mkdir -p "$screenshot_dir"

    # Launch app
    adb -P ${port} shell am start -n "${TEST_PACKAGE}/.MainActivity" 2>/dev/null || true
    sleep 3

    # Capture screenshots
    local timestamp=$(date +%Y%m%d_%H%M%S)

    # Screenshot 1: Home screen
    adb -P ${port} shell screencap -p "/sdcard/screen_home.png" 2>/dev/null
    adb -P ${port} pull "/sdcard/screen_home.png" "${screenshot_dir}/home_${timestamp}.png" 2>/dev/null || true

    # Screenshot 2: After interaction (if app supports it)
    adb -P ${port} shell input tap 540 1200 2>/dev/null || true
    sleep 1
    adb -P ${port} shell screencap -p "/sdcard/screen_detail.png" 2>/dev/null
    adb -P ${port} pull "/sdcard/screen_detail.png" "${screenshot_dir}/detail_${timestamp}.png" 2>/dev/null || true

    log_success "Screenshots saved to ${screenshot_dir}"
}

# Run tests on a single emulator
test_single_emulator() {
    local avd_name=$1
    local device_name=$2
    local port=$3
    local apk_path=$4

    log_info "========================================"
    log_info "Testing on: ${device_name}"
    log_info "AVD: ${avd_name}"
    log_info "========================================"

    local pid
    if ! pid=$(start_emulator "$avd_name" "$port"); then
        log_error "Failed to start emulator ${avd_name}"
        return 1
    fi

    local result=0

    # Install app if APK provided
    if [ -n "$apk_path" ]; then
        if ! install_app "$port" "$apk_path"; then
            log_warn "App installation failed, continuing with tests..."
        fi
    fi

    # Run tests
    run_rn_tests "$port" "$avd_name"
    local test_result=$?

    # Capture screenshots
    if [ "$CAPTURE_SCREENSHOTS" = "true" ]; then
        run_screenshot_test "$port" "$avd_name" "$device_name"
    fi

    # Stop emulator
    stop_emulator "$port"
    wait $pid 2>/dev/null || true

    return $test_result
}

# Run tests on all emulators sequentially
run_all_tests_sequential() {
    local apk_path=$1

    log_info "Starting sequential test run on all emulators"

    # Get list of emulators
    local emulators=($(get_emulator_list))
    local total=${#emulators[@]}

    if [ $total -eq 0 ]; then
        log_error "No app_cleaner emulators found. Run setup-emulators.sh first."
        exit 1
    fi

    log_info "Found ${total} emulators"

    local passed=0
    local failed=0
    local start_port=5554

    for i in $(seq 0 $((total - 1))); do
        local avd_name="${emulators[$i]}"
        # Extract device name from AVD name
        local device_name=$(echo "$avd_name" | sed 's/app_cleaner_//; s/_/ /g; s/\b\w/\u&/g')
        local port=$((start_port + i * 2))

        echo ""
        if test_single_emulator "$avd_name" "$device_name" "$port" "$apk_path"; then
            ((passed++))
        else
            ((failed++))
        fi
    done

    echo ""
    echo "========================================"
    log_success "Test run complete!"
    echo "  Total: ${total}"
    echo "  Passed: ${passed}"
    echo "  Failed: ${failed}"
    echo "========================================"

    return $((failed > 0 ? 1 : 0))
}

# Run tests on all emulators in parallel (max 4 concurrent)
run_all_tests_parallel() {
    local apk_path=$1
    local max_parallel=${2:-4}

    log_info "Starting parallel test run (max ${max_parallel} concurrent)"

    local emulators=($(get_emulator_list))
    local total=${#emulators[@]}

    if [ $total -eq 0 ]; then
        log_error "No app_cleaner emulators found. Run setup-emulators.sh first."
        exit 1
    fi

    log_info "Found ${total} emulators"

    local passed=0
    local failed=0
    local pids=()
    local start_port=5554
    local results_file=$(mktemp)

    # Process emulators in batches
    for ((i=0; i<total; i++)); do
        local avd_name="${emulators[$i]}"
        local device_name=$(echo "$avd_name" | sed 's/app_cleaner_//; s/_/ /g; s/\b\w/\u&/g')
        local port=$((start_port + i * 2))

        # Run test in background
        (
            if test_single_emulator "$avd_name" "$device_name" "$port" "$apk_path"; then
                echo "PASS:${avd_name}" >> "$results_file"
            else
                echo "FAIL:${avd_name}" >> "$results_file"
            fi
        ) &
        pids+=($!)

        # Wait if we've reached max parallel
        if [ ${#pids[@]} -ge $max_parallel ]; then
            wait ${pids[0]}
            pids=(${pids[@]:1})
        fi
    done

    # Wait for remaining processes
    for pid in "${pids[@]}"; do
        wait $pid
    done

    # Count results
    passed=$(grep -c "^PASS:" "$results_file" 2>/dev/null || echo 0)
    failed=$(grep -c "^FAIL:" "$results_file" 2>/dev/null || echo 0)
    rm -f "$results_file"

    echo ""
    echo "========================================"
    log_success "Parallel test run complete!"
    echo "  Total: ${total}"
    echo "  Passed: ${passed}"
    echo "  Failed: ${failed}"
    echo "========================================"

    return $((failed > 0 ? 1 : 0))
}

# Run tests on specific device types
run_tests_by_type() {
    local type=$1
    local apk_path=$2

    log_info "Running tests for device type: ${type}"

    local emulators=($(get_emulator_list | grep "${type}"))
    local total=${#emulators[@]}

    if [ $total -eq 0 ]; then
        log_error "No emulators found for type: ${type}"
        exit 1
    fi

    log_info "Found ${total} emulators of type ${type}"

    local passed=0
    local failed=0
    local start_port=5554

    for i in $(seq 0 $((total - 1))); do
        local avd_name="${emulators[$i]}"
        local device_name=$(echo "$avd_name" | sed 's/app_cleaner_//; s/_/ /g; s/\b\w/\u&/g')
        local port=$((start_port + i * 2))

        if test_single_emulator "$avd_name" "$device_name" "$port" "$apk_path"; then
            ((passed++))
        else
            ((failed++))
        fi
    done

    return $((failed > 0 ? 1 : 0))
}

# Generate test report
generate_report() {
    local report_file="$PROJECT_ROOT/test-report-$(date +%Y%m%d-%H%M%S).md"

    log_info "Generating test report: ${report_file}"

    cat > "$report_file" << EOF
# Device Compatibility Test Report

**Date:** $(date +%Y-%m-%d\ %H:%M:%S)

## Summary

### Device Matrix

| Type | Count |
|------|-------|
| Standard | 3 |
| Notch | 3 |
| Teardrop | 2 |
| Hole Punch (Center) | 4 |
| Hole Punch (Left) | 2 |
| Waterfall | 3 |
| Pill | 1 |
| Tablet | 2 |
| Foldable Cover | 2 |
| Foldable Inner | 2 |
| **Total** | **24** |

### API Level Distribution

| API | Android Version | Devices |
|-----|-----------------|---------|
| 28 | 9.0 | 2 |
| 29 | 10.0 | 3 |
| 30 | 11.0 | 2 |
| 31 | 12.0 | 3 |
| 33 | 13.0 | 11 |
| 34 | 14.0 | 3 |

### Test Results

See console output for detailed test results.

## Configuration

All emulators created based on \`emulator-config.json\`.

EOF

    log_success "Report generated: ${report_file}"
}

# Main execution
main() {
    echo "========================================"
    echo "  Device Compatibility Test Runner"
    echo "  Mistap Media Cleaner"
    echo "========================================"
    echo ""

    local apk_path=""
    local mode="sequential"
    local device_type=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --apk)
                apk_path="$2"
                shift 2
                ;;
            --parallel)
                mode="parallel"
                shift
                ;;
            --type)
                device_type="$2"
                shift 2
                ;;
            --screenshots)
                export CAPTURE_SCREENSHOTS=true
                shift
                ;;
            --report)
                generate_report
                exit 0
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --apk PATH         Path to APK file to install"
                echo "  --parallel         Run tests in parallel (max 4 concurrent)"
                echo "  --type TYPE        Run tests only for specific device type"
                echo "                     (standard, notch, teardrop, hole-punch, etc.)"
                echo "  --screenshots      Capture screenshots during testing"
                echo "  --report           Generate test report"
                echo "  --help, -h         Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 --apk app-debug.apk"
                echo "  $0 --apk app-debug.apk --parallel"
                echo "  $0 --type notch --apk app-debug.apk"
                echo "  $0 --screenshots --apk app-debug.apk"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Run '$0 --help' for usage information"
                exit 1
                ;;
        esac
    done

    check_prerequisites

    if [ -n "$device_type" ]; then
        run_tests_by_type "$device_type" "$apk_path"
    elif [ "$mode" = "parallel" ]; then
        run_all_tests_parallel "$apk_path"
    else
        run_all_tests_sequential "$apk_path"
    fi

    local exit_code=$?

    # Generate report if requested or on success
    if [ "$GENERATE_REPORT" = "true" ] || [ $exit_code -eq 0 ]; then
        generate_report
    fi

    exit $exit_code
}

main "$@"

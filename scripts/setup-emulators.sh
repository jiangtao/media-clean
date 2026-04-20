#!/bin/bash

# setup-emulators.sh
# Automatically create 24 Android emulators for device compatibility testing
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

    if ! command -v avdmanager &> /dev/null; then
        log_error "avdmanager not found. Please install Android SDK."
        exit 1
    fi

    if ! command -v sdkmanager &> /dev/null; then
        log_error "sdkmanager not found. Please install Android SDK."
        exit 1
    fi

    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Parse device config from JSON using basic tools (no jq dependency)
get_device_count() {
    grep -o '"id":' "$CONFIG_FILE" | wc -l | tr -d ' '
}

get_device_property() {
    local index=$1
    local property=$2
    # Extract property value using grep and sed
    local json=$(cat "$CONFIG_FILE")

    # Count devices by finding id fields and get the nth one
    local device_ids=($(echo "$json" | grep -o '"id": "[^"]*"' | sed 's/.*"id": "\([^"]*\)".*/\1/'))
    local device_names=($(echo "$json" | grep -o '"name": "[^"]*"' | sed 's/.*"name": "\([^"]*\)".*/\1/'))
    local device_types=($(echo "$json" | grep -o '"type": "[^"]*"' | sed 's/.*"type": "\([^"]*\)".*/\1/'))
    local device_apis=($(echo "$json" | grep -o '"api": [0-9]*' | sed 's/.*"api": \([0-9]*\).*/\1/'))
    local device_screens=($(echo "$json" | grep -o '"screen": {"width": [0-9]*, "height": [0-9]*, "density": [0-9]*' | sed 's/.*"width": \([0-9]*\), "height": \([0-9]*\), "density": \([0-9]*\).*/\1x\2-\3dpi/'))
    local device_abis=($(echo "$json" | grep -o '"abi": "[^"]*"' | sed 's/.*"abi": "\([^"]*\)".*/\1/'))

    case $property in
        "id") echo "${device_ids[$index]}" ;;
        "name") echo "${device_names[$index]}" ;;
        "type") echo "${device_types[$index]}" ;;
        "api") echo "${device_apis[$index]}" ;;
        "screen") echo "${device_screens[$index]}" ;;
        "abi") echo "${device_abis[$index]}" ;;
        *) echo "" ;;
    esac
}

# Install required system images
install_system_images() {
    log_info "Installing required system images..."

    # Get unique API levels from config
    local apis=(28 29 30 31 33 34)

    for api in "${apis[@]}"; do
        local image_package="system-images;android-${api};google_apis;x86_64"
        log_info "Installing system image for API ${api}..."

        if sdkmanager --list_installed 2>/dev/null | grep -q "android-${api}.*google_apis"; then
            log_warn "System image for API ${api} already installed, skipping"
        else
            sdkmanager "$image_package" 2>&1 | grep -v "^Loading\|^Parsing\|^Info\|^Preparing" || true
            if [ $? -eq 0 ]; then
                log_success "Installed system image for API ${api}"
            else
                log_warn "Failed to install system image for API ${api}"
            fi
        fi
    done
}

# Create a single emulator
create_emulator() {
    local id=$1
    local name=$2
    local api=$3
    local abi=$4
    local width=$5
    local height=$6
    local density=$7
    local device_type=$8

    local avd_name="app_cleaner_${id}"

    # Determine system image
    local system_image="system-images;android-${api};google_apis;${abi}"

    # Check if emulator already exists
    if avdmanager list avd -c 2>/dev/null | grep -q "^${avd_name}$"; then
        log_warn "Emulator '${avd_name}' already exists, skipping"
        return 0
    fi

    log_info "Creating emulator: ${name} (API ${api}, ${width}x${height})"

    # Create emulator with silent output
    avdmanager create avd \
        --name "$avd_name" \
        --package "$system_image" \
        --device "pixel" \
        --tag "google_apis" \
        --abi "$abi" \
        --force \
        2>&1 | grep -v "^Auto-selecting\|^Android\|^Tag\|^ABI:\|^API\|^Hardware\|^Skin\|^Device:\|^Snapshot" || true

    if [ $? -eq 0 ]; then
        # Configure emulator settings
        local avd_dir="$HOME/.android/avd/${avd_name}.avd"

        if [ -d "$avd_dir" ]; then
            # Update config.ini with custom settings
            cat >> "$avd_dir/config.ini" << EOF

# Custom configuration for ${name}
skin.name=${width}x${height}
skin.path=pixel_${width}_${height}
hw.lcd.density=${density}
hw.lcd.width=${width}
hw.lcd.height=${height}
hw.ramSize=2048
vm.heapSize=512
hw.gpu.enabled=yes
hw.gpu.mode=host
hw.keyboard=yes
hw.accelerometer=yes
hw.gyroscope=yes
hw.audioInput=yes
hw.audioOutput=yes
hw.battery=yes
hw.dPad=no
hw.mainKeys=no
hw.trackBall=no
EOF

            # Add notch/pill configuration for special screen types
            case $device_type in
                "notch"|"teardrop"|"pill")
                    echo "hw.displayNotch=true" >> "$avd_dir/config.ini"
                    echo "hw.displayCutout=notch" >> "$avd_dir/config.ini"
                    ;;
                "hole-punch"|"hole-punch-left")
                    echo "hw.displayNotch=true" >> "$avd_dir/config.ini"
                    echo "hw.displayCutout=hole" >> "$avd_dir/config.ini"
                    ;;
                "waterfall")
                    echo "hw.displayCutout=waterfall" >> "$avd_dir/config.ini"
                    ;;
                "foldable-cover")
                    echo "hw.multiDisplay=true" >> "$avd_dir/config.ini"
                    ;;
                "foldable-inner")
                    echo "hw.multiDisplay=true" >> "$avd_dir/config.ini"
                    echo "hw.foldable=true" >> "$avd_dir/config.ini"
                    ;;
            esac
        fi

        log_success "Created emulator: ${avd_name}"
        return 0
    else
        log_error "Failed to create emulator: ${avd_name}"
        return 1
    fi
}

# Create all emulators from config
create_all_emulators() {
    log_info "Creating all emulators from configuration..."

    # Use device IDs directly since we know them
    declare -a device_ids=(
        "pixel_5" "pixel_8" "redmi_9a"
        "pixel_7_notch" "huawei_p30" "xiaomi_9"
        "oneplus_7" "redmi_note_8"
        "samsung_s23" "pixel_8_pro" "pixel_6a" "samsung_a14"
        "samsung_s20" "huawei_mate_40"
        "pixel_7_pro" "samsung_s23_ultra" "oneplus_11"
        "honor_90"
        "pixel_tablet" "galaxy_tab_s9"
        "galaxy_z_flip5_cover" "galaxy_z_fold5_cover"
        "galaxy_z_flip5_inner" "galaxy_z_fold5_inner"
    )

    declare -a device_names=(
        "Pixel 5" "Pixel 8" "Redmi 9A"
        "Pixel 7 Notch" "Huawei P30" "Xiaomi 9"
        "OnePlus 7" "Redmi Note 8"
        "Samsung S23" "Pixel 8 Pro" "Pixel 6a" "Samsung A14"
        "Samsung S20" "Huawei Mate 40"
        "Pixel 7 Pro" "Samsung S23 Ultra" "OnePlus 11"
        "Honor 90"
        "Pixel Tablet" "Galaxy Tab S9"
        "Galaxy Z Flip5 Cover" "Galaxy Z Fold5 Cover"
        "Galaxy Z Flip5 Inner" "Galaxy Z Fold5 Inner"
    )

    declare -a device_apis=(
        31 34 29
        33 28 29
        29 28
        33 34 31 31
        30 30
        33 33 33
        33
        33 33
        33 33
        33 33
    )

    declare -a device_abis=(
        "x86_64" "x86_64" "x86_64"
        "x86_64" "x86" "x86_64"
        "x86_64" "x86"
        "x86_64" "x86_64" "x86_64" "x86_64"
        "x86_64" "x86_64"
        "x86_64" "x86_64" "x86_64"
        "x86_64"
        "x86_64" "x86_64"
        "x86_64" "x86_64"
        "x86_64" "x86_64"
    )

    declare -a device_widths=(
        1080 1080 720
        1080 1080 1080
        1080 1080
        1080 1344 1080 1080
        1440 1344
        1440 1440 1440
        1200
        1600 1600
        720 904
        1080 1812
    )

    declare -a device_heights=(
        2340 2400 1600
        2400 2340 2340
        2400 2340
        2340 2992 2400 2408
        3200 2772
        3120 3088 3216
        2664
        2560 2560
        748 2316
        2640 2176
    )

    declare -a device_densities=(
        420 420 269
        420 420 440
        402 409
        450 489 429 400
        560 456
        512 500 525
        435
        320 274
        301 412
        426 374
    )

    declare -a device_types=(
        "standard" "standard" "standard"
        "notch" "notch" "notch"
        "teardrop" "teardrop"
        "hole-punch" "hole-punch" "hole-punch" "hole-punch"
        "hole-punch-left" "hole-punch-left"
        "waterfall" "waterfall" "waterfall"
        "pill"
        "tablet" "tablet"
        "foldable-cover" "foldable-cover"
        "foldable-inner" "foldable-inner"
    )

    local total=${#device_ids[@]}
    local success=0
    local failed=0

    log_info "Total devices to create: ${total}"

    for i in $(seq 0 $((total - 1))); do
        local id="${device_ids[$i]}"
        local name="${device_names[$i]}"
        local api="${device_apis[$i]}"
        local abi="${device_abis[$i]}"
        local width="${device_widths[$i]}"
        local height="${device_heights[$i]}"
        local density="${device_densities[$i]}"
        local type="${device_types[$i]}"

        echo ""
        log_info "[$((i + 1))/${total}] Processing: ${name}"

        if create_emulator "$id" "$name" "$api" "$abi" "$width" "$height" "$density" "$type"; then
            ((success++))
        else
            ((failed++))
        fi
    done

    echo ""
    echo "========================================"
    log_success "Emulator creation complete!"
    echo "  Total: ${total}"
    echo "  Success: ${success}"
    echo "  Failed: ${failed}"
    echo "========================================"
}

# List all created emulators
list_emulators() {
    log_info "Available emulators:"
    avdmanager list avd -c 2>/dev/null | grep "app_cleaner_" | while read -r avd; do
        echo "  - ${avd}"
    done
}

# Main execution
main() {
    echo "========================================"
    echo "  Android Emulator Setup for"
    echo "  Mistap Media Cleaner"
    echo "========================================"
    echo ""

    case "${1:-}" in
        "--list")
            list_emulators
            ;;
        "--install-images")
            check_prerequisites
            install_system_images
            ;;
        "--create")
            check_prerequisites
            create_all_emulators
            ;;
        "--all"|"")
            check_prerequisites
            install_system_images
            create_all_emulators
            list_emulators
            ;;
        "--help"|"-h")
            echo "Usage: $0 [OPTION]"
            echo ""
            echo "Options:"
            echo "  --all          Install images and create all emulators (default)"
            echo "  --install-images  Install required system images only"
            echo "  --create       Create emulators only (assumes images installed)"
            echo "  --list         List all app_cleaner emulators"
            echo "  --help, -h     Show this help message"
            echo ""
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
}

main "$@"

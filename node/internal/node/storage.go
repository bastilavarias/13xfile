package node

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var storagePattern = regexp.MustCompile(`(?i)^([1-9][0-9]*)(B|KB|MB|GB|TB|KIB|MIB|GIB|TIB)$`)

func normalizeStorage(value string) (string, error) {
	value = strings.TrimSpace(value)
	match := storagePattern.FindStringSubmatch(value)
	if match == nil {
		return "", fmt.Errorf("invalid storage value %q; use values such as 50GB, 500GB, or 2TB", value)
	}

	n, err := strconv.ParseUint(match[1], 10, 64)
	if err != nil || n == 0 {
		return "", fmt.Errorf("invalid storage value %q", value)
	}

	unit := strings.ToUpper(match[2])
	return fmt.Sprintf("%d%s", n, unit), nil
}

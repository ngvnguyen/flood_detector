# Chuyển 3 class (0, 1, 2) về 1 class duy nhất (0: ngap_lut)
import os
labels_dir = "flood_training/flood_dataset/labels"
for root, _, files in os.walk(labels_dir):
    for f in files:
        if f.endswith(".txt"):
            filepath = os.path.join(root, f)
            with open(filepath, "r", encoding="utf-8") as fp:
                lines = fp.readlines()
            
            new_lines = []
            for line in lines:
                parts = line.strip().split()
                if parts:
                    # Đổi bất kỳ class id nào (0, 1, 2) về thành 0 (ngap_lut)
                    parts[0] = "0"
                    new_lines.append(" ".join(parts) + "\n")
            
            with open(filepath, "w", encoding="utf-8") as fp:
                fp.writelines(new_lines)
print("✅ Đã chuyển đổi toàn bộ nhãn về 1 class duy nhất (0: ngap_lut)!")
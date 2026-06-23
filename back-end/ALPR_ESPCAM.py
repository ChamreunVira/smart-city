import cv2
import time
from fast_alpr import ALPR

alpr = ALPR(
    detector_model="yolo-v9-t-384-license-plate-end2end",
    ocr_model="cct-xs-v2-global-model"
)

cap = cv2.VideoCapture("./assets/traffic.mp4")

if not cap.isOpened():
    print("Cannot open video file")
    exit()

last_time = 0
detected = set()

print("ALPR Running...")

while True:
    success, frame = cap.read()

    if not success or frame is None:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        continue

    drawn = alpr.draw_predictions(frame)
    annotated_frame = drawn.image

    for r in drawn.results:
        try:
            plate = r.ocr.text
            conf = r.ocr.confidence
            
            if len(plate) < 7:
                continue

            if plate:
                detected.add(plate)

            if time.time() - last_time > 1:
                # print(f"Plate: {plate} | Conf: {conf}")
                print(f"Plat: {plate}")
                print(f"Total Vehicles: {len(detected)}")
                last_time = time.time()

        except:
            pass

    cv2.putText(
        annotated_frame,
        f"Total Vehicles: {len(detected)}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (0, 255, 255),
        2
    )

    cv2.imshow("ALPR Smart System", annotated_frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
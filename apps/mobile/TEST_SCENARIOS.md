# Mobile Integration Scenarios

## Runtime

1. 앱 실행 후 GL 씬이 3초 내에 표시되는지 확인
2. 드래그 시 카메라가 회전하는지 확인
3. 핀치 인/아웃 시 줌이 정상 동작하는지 확인
4. 더블탭 시 카메라가 기본 시점으로 리셋되는지 확인

## Time Controls

1. `Switch to Manual` 전환 후 HUD 모드가 `MANUAL`로 바뀌는지 확인
2. `-1h`, `+1h` 버튼이 시각을 변경하는지 확인
3. `Now` 버튼이 현재 시각으로 동기화되는지 확인
4. `Switch to Live` 전환 후 HUD 모드가 `LIVE`로 바뀌는지 확인

## Lifecycle

1. 앱 백그라운드 전환 후 다시 포그라운드 복귀 시 렌더가 재개되는지 확인
2. 복귀 후 HUD `System` 값이 `Simulation running`으로 유지되는지 확인

## Offline

1. 비행기 모드에서 앱 실행
2. 디스크 텍스처/태양/달이 모두 렌더링되는지 확인

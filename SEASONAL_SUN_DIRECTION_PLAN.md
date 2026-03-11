# 4절기에 따른 태양 궤도 진행방향 변경 구현안

## 1. 목적

현재 데모 공전 모드에서는 태양이 항상 동일한 각도 방향으로만 이동한다.

- `app.js`의 렌더 루프에서 `simulationState.orbitSunAngle += ORBIT_SUN_SPEED`로 고정 증가
- `modules/astronomy-controller.js`의 `getCurrentOrbitRadius()`는 계절에 따라 반지름만 변화

요구사항은 `춘분`, `하지`, `추분`, `동지`를 기준으로 태양 궤도의 진행방향을 바꿀 수 있게 만드는 것이다.

이 구현안은 다음 전제를 둔다.

- 방향 변경은 `astronomyState.enabled === false`인 데모 모드에만 적용
- 현실 천문 동기화 모드는 `modules/astronomy-utils.js`의 실제 천문 계산 결과를 유지
- 계절별 규칙은 하드코딩하지 않고 테이블화해서 이후 변경 가능하게 설계

## 2. 현재 구조 요약

### 데모 모드

- 각도: `simulationState.orbitSunAngle`
- 계절 위상: `simulationState.orbitSeasonPhase`
- 반지름 계산: `astronomyApi.getCurrentOrbitRadius()`
- 위치 반영:

```js
orbitSun.position.set(
  Math.cos(simulationState.orbitSunAngle) * orbitRadius,
  astronomyApi.getSunOrbitHeight(orbitRadius),
  Math.sin(simulationState.orbitSunAngle) * orbitRadius
);
```

### 현실 동기화 모드

- `getAstronomySnapshot()`이 태양 위도/경도와 3D 위치를 직접 계산
- 이 경로는 방향 제어 대상에서 제외

## 3. 구현 목표 상태

태양 이동은 아래 두 축으로 분리한다.

1. `angularDirection`
   - 원 궤도를 도는 방향
   - 예: 시계 방향 `1`, 반시계 방향 `-1`
2. `seasonSegment`
   - 현재 구간이 `춘분~하지`, `하지~추분`, `추분~동지`, `동지~춘분` 중 어디인지

이렇게 분리하면 "계절별 공전 방향"과 "계절별 반지름 변화"를 독립적으로 관리할 수 있다.

## 4. 설계 보정: 황도 12궁과 십자가 축 기준

`황도 12궁에서 절기별 태양의 위치`를 기준으로 보면, 이전 안의 "춘분/추분에서 공전 방향 자체를 반전"하는 가정은 보정이 필요하다.

이유는 다음과 같다.

- 태양은 연중 황도 12궁을 순차적으로 통과해야 함
- 4절기는 황도상의 4개 기본 기준점임
- 이 4개 기준점은 서로 90도 간격이므로 상면 투영에서 십자가 축으로 배치하는 것이 자연스러움

권장 기준점은 아래와 같다.

| 절기 | 황도 기준 | 황경 | 회귀선/위도 기준 |
| --- | --- | --- | --- |
| 춘분 | 양자리 시작점 | 0deg | 적도 |
| 하지 | 게자리 시작점 | 90deg | 북회귀선 |
| 추분 | 천칭자리 시작점 | 180deg | 적도 |
| 동지 | 염소자리 시작점 | 270deg | 남회귀선 |

즉, 구현의 주 상태는 `공전 방향 반전`보다 `황경(ecliptic longitude)`이어야 한다.

- 태양은 `0 -> 360deg`를 한 방향으로 순환
- 절기별로 바뀌는 것은 `반지름/위도 보간 규칙`
- 십자가 형태는 `춘분-추분 축`과 `하지-동지 축`을 월드 기준축에 고정하는 방식으로 반영

따라서 기본 모델은 아래가 더 타당하다.

1. 황도 진행 순서는 유지
2. 12궁은 30도 단위로 분할
3. 4절기는 90도마다 등장하는 앵커 포인트
4. 북/남 회귀선 이동은 각 앵커 사이 구간 보간으로 계산

만약 기획 의도가 실제로 "절기마다 각도 진행방향도 뒤집는다"라면, 그것은 황도 12궁 순차 진행과 충돌하는 별도 데모 규칙으로 분리해야 한다.

## 5. 변경 포인트

### 5.1 `app.js`

`simulationState`는 `위상 + 방향` 중심이 아니라 `황경 + 절기 구간` 중심으로 잡는 것이 맞다.

```js
const simulationState = {
  orbitMoonAngle: Math.PI * 0.35,
  orbitMode: "auto",
  orbitSunLongitudeDeg: 0,
  orbitSeasonSegment: "springToSummer",
  orbitZodiacIndex: 0
};
```

렌더 루프에서는 `황경`을 한 방향으로만 증가시킨다.

```js
simulationState.orbitSunLongitudeDeg =
  normalizeDegrees(simulationState.orbitSunLongitudeDeg + ORBIT_SUN_LONGITUDE_SPEED_DEG);
```

즉, 방향 제어의 기준은 `sign`이 아니라 `longitude`다.

### 5.2 `modules/astronomy-controller.js`

아래 책임을 추가한다.

- 현재 황경이 어느 황도 12궁 구간에 속하는지 판정
- 현재 황경이 어느 절기 구간에 속하는지 판정
- 절기 앵커 사이의 반지름/위도 보간
- 4개 절기 앵커를 십자가 축에 정렬
- 절기 경계 통과 시 트레일을 끊어서 시각적 궤적 꼬임 방지

권장 추가 함수:

- `getZodiacIndexFromLongitude(longitudeDeg)`
- `getSeasonSegmentFromLongitude(longitudeDeg)`
- `getSeasonalAnchorRadius(longitudeDeg)`
- `getInterpolatedOrbitRadius(longitudeDeg)`
- `getWorldAngleFromLongitude(longitudeDeg)`

### 5.3 `modules/astronomy-utils.js`

직접 수정은 필수는 아니지만, 이미 `SEASONAL_EVENT_DEFINITIONS`가 있으므로 이름 체계를 맞추기 위해 계절 구간 상수도 이 파일 또는 별도 상수 파일로 빼는 것이 좋다.

## 6. 황도 12궁 기준 구간 판정안

기존 `sin(orbitSeasonPhase)` 기반 모델은 반지름 변화에는 단순하지만, 황도 12궁과 절기 앵커를 직접 표현하기 어렵다.

따라서 자동 모드 기준값을 아래처럼 바꾸는 편이 낫다.

```js
const longitudeDeg = normalizeDegrees(simulationState.orbitSunLongitudeDeg);
const zodiacIndex = Math.floor(longitudeDeg / 30);
```

황도 12궁 매핑:

| 황경 구간 | 황도 12궁 | 절기 구간 |
| --- | --- | --- |
| 0deg ~ 30deg | 양자리 | 춘분 -> 하지 |
| 30deg ~ 60deg | 황소자리 | 춘분 -> 하지 |
| 60deg ~ 90deg | 쌍둥이자리 | 춘분 -> 하지 |
| 90deg ~ 120deg | 게자리 | 하지 -> 추분 |
| 120deg ~ 150deg | 사자자리 | 하지 -> 추분 |
| 150deg ~ 180deg | 처녀자리 | 하지 -> 추분 |
| 180deg ~ 210deg | 천칭자리 | 추분 -> 동지 |
| 210deg ~ 240deg | 전갈자리 | 추분 -> 동지 |
| 240deg ~ 270deg | 사수자리 | 추분 -> 동지 |
| 270deg ~ 300deg | 염소자리 | 동지 -> 춘분 |
| 300deg ~ 330deg | 물병자리 | 동지 -> 춘분 |
| 330deg ~ 360deg | 물고기자리 | 동지 -> 춘분 |

절기 앵커 반지름은 아래처럼 둔다.

- `0deg`: 적도 반지름
- `90deg`: 북회귀선 반지름
- `180deg`: 적도 반지름
- `270deg`: 남회귀선 반지름

그 사이 값은 선형 보간보다 `smoothstep` 또는 cubic easing으로 보간하는 것이 궤도 전환이 덜 거칠다.

```js
function getInterpolatedOrbitRadius(longitudeDeg) {
  if (longitudeDeg < 90) return easeBetween(EQUATOR_RADIUS, TROPIC_CANCER_RADIUS, longitudeDeg / 90);
  if (longitudeDeg < 180) return easeBetween(TROPIC_CANCER_RADIUS, EQUATOR_RADIUS, (longitudeDeg - 90) / 90);
  if (longitudeDeg < 270) return easeBetween(EQUATOR_RADIUS, TROPIC_CAPRICORN_RADIUS, (longitudeDeg - 180) / 90);
  return easeBetween(TROPIC_CAPRICORN_RADIUS, EQUATOR_RADIUS, (longitudeDeg - 270) / 90);
}
```

이렇게 하면 절기와 황도 12궁을 동시에 설명할 수 있다.

## 7. 처리 흐름

```js
simulationState.orbitSunLongitudeDeg =
  normalizeDegrees(simulationState.orbitSunLongitudeDeg + ORBIT_SUN_LONGITUDE_SPEED_DEG);

const longitudeDeg = simulationState.orbitSunLongitudeDeg;
const nextSegment = astronomyApi.getSeasonSegmentFromLongitude(longitudeDeg);
const nextZodiacIndex = astronomyApi.getZodiacIndexFromLongitude(longitudeDeg);
const orbitRadius = astronomyApi.getInterpolatedOrbitRadius(longitudeDeg);
const worldAngle = astronomyApi.getWorldAngleFromLongitude(longitudeDeg);

if (nextSegment !== simulationState.orbitSeasonSegment) {
  simulationState.orbitSeasonSegment = nextSegment;
  astronomyApi.resetSunTrail();
}

simulationState.orbitZodiacIndex = nextZodiacIndex;

orbitSun.position.set(
  Math.cos(worldAngle) * orbitRadius,
  astronomyApi.getSunOrbitHeight(orbitRadius),
  Math.sin(worldAngle) * orbitRadius
);
```

`getWorldAngleFromLongitude()`는 십자가 축 정렬을 담당한다.

예시 기준:

- `0deg` 춘분점: +Z 축
- `90deg` 하지점: +X 축
- `180deg` 추분점: -Z 축
- `270deg` 동지점: -X 축

즉, `춘분-추분`, `하지-동지`가 직교하는 십자가 형태로 고정된다.

## 8. UI 반영안

최소 반영 범위는 아래와 같다.

- `seasonSummaryEl` 또는 `orbitLabelEl`에 현재 절기 구간과 황도궁 표시
- 예: `춘분 -> 하지 · 황소자리`
- `seasonalSunGridEl`에 `황경`, `황도 12궁`, `회귀선 기준 반지름` 추가

선택 반영:

- 절기 앵커 4점을 십자가 마커로 시각화
- 계절 버튼 선택 시 해당 황도궁 시작점 하이라이트

## 9. 테스트 항목

### 기능 테스트

- 자동 공전 모드에서 태양이 양자리 -> 황소자리 -> ... -> 물고기자리 순으로 진행하는지
- `0/90/180/270deg`에서 각각 춘분/하지/추분/동지 앵커가 정확히 맞는지
- `90deg`에서 북회귀선, `270deg`에서 남회귀선 반지름이 정확히 적용되는지
- 절기 경계 통과 시 트레일이 자연스럽게 끊기고 재시작되는지

### 회귀 테스트

- 현실 천문 동기화 모드에서 태양 위치 계산이 변하지 않는지
- 낮/밤 오버레이가 데모 태양 위치를 따라 정상 갱신되는지
- `sunTrail`이 방향 전환 시 지그재그나 직선 관통 없이 초기화되는지
- 달 궤도와 워커 시점 렌더링에 부작용이 없는지

## 10. 리스크

- 황경과 월드 각도를 혼용하면 12궁 표시는 맞는데 실제 배치 축이 어긋날 수 있음
- 십자가 축을 반영하면서 기존 원형 궤도 가정이 남아 있으면 절기 앵커가 부정확해질 수 있음
- 트레일 초기화를 하지 않으면 절기 앵커 통과 시 궤적이 시각적으로 잘못 연결될 수 있음
- 데모 모드와 현실 동기화 모드의 책임을 섞으면 실제 천문 계산 화면까지 왜곡될 수 있음

## 11. 구현 순서

1. 4절기 앵커와 황도 12궁 매핑 테이블 정의
2. `simulationState`를 `orbitSunLongitudeDeg` 중심 구조로 전환
3. `astronomy-controller.js`에 황경 기반 구간 판정/반지름 보간 함수 추가
4. 십자가 기준축에 맞는 `getWorldAngleFromLongitude()` 구현
5. `app.js` 렌더 루프를 황경 기반 업데이트로 교체
6. 절기 경계 통과 시 `resetSunTrail()` 호출
7. UI에 황도궁/황경/절기 앵커 정보 표시
8. 데모 모드/현실 모드 회귀 확인

## 12. 결론

현재 요구를 엄밀히 반영하려면, 태양 이동의 기준을 `방향 반전`이 아니라 `황경 기반 위치 계산`으로 바꾸는 것이 맞다.

실제 작업 포인트는 `app.js`의 고정 각도 증가를 `orbitSunLongitudeDeg` 기반으로 교체하고, `astronomy-controller.js`에 `황도 12궁 + 4절기 앵커 + 십자가 축` 계산을 넣는 것이다.

이 방식이면 향후 "12궁 라벨 표시", "절기 앵커 고정", "특정 황도궁 하이라이트", "십자가 축 시각화" 같은 확장도 자연스럽게 수용할 수 있다.

# Flat Earth Model Mobile (Expo)

독립형 iOS/Android 앱으로 동작하는 Expo 기반 3D 뷰어입니다.

## 포함 범위 (MVP)

- 네이티브 GL 기반 디스크/태양/달 렌더링
- 카메라 제스처: 드래그 회전, 핀치 줌, 더블탭 리셋
- 시간 모드: 실시간(Live) / 수동(Manual)
- 기본 HUD: 시각, 태양 위도, 시스템 상태, 품질/프레임
- 오프라인 번들 자산 사용

## 실행

```bash
cd apps/mobile
npm install
npm run start
```

## 빌드/배포

```bash
cd apps/mobile
npx eas build --profile development --platform android
npx eas build --profile preview --platform ios
npx eas build --profile production --platform all
```

스토어 제출용 체크리스트는 `store/metadata-checklist.md`를 참고합니다.

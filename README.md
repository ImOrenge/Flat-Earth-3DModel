# Flat Earth 3D Model

평면지도를 원판형 3D 모델 상단 텍스처로 사용하는 간단한 프로젝트입니다.

## Files

- `index.html`: Three.js 기반 미리보기
- `app.js`: 원판 + 빙벽 형태의 3D 장면
- `scripts/generate-flat-earth-obj.ps1`: OBJ/MTL 모델 생성 스크립트
- `models/flat-earth-disc.obj`: 생성 결과물
- `models/flat-earth-disc.mtl`: 재질 파일

## Use

1. 제공한 평면지도 이미지를 `assets/flat-earth-map.png`로 저장합니다.
2. PowerShell에서 아래 명령을 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-flat-earth-obj.ps1
```

3. 생성된 `models/flat-earth-disc.obj`를 Blender, Maya, Unity 등에서 엽니다.
4. 웹 미리보기가 필요하면 아래처럼 간단한 로컬 서버로 띄웁니다.

```powershell
py -m http.server 8000
```

그 다음 브라우저에서 `http://127.0.0.1:8000/index.html`을 엽니다.

## Notes

- 기본 텍스처가 없으면 웹 뷰어는 임시 안내 이미지를 표시합니다.
- OBJ/MTL은 평면지도 텍스처를 상단 면에만 적용하도록 작성되어 있습니다.

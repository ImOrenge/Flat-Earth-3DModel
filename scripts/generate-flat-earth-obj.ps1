$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$modelDir = Join-Path $root "models"
$assetDir = Join-Path $root "assets"
$sourceTexturePath = Join-Path $assetDir "flat-earth-map.png"
$squareTexturePath = Join-Path $assetDir "flat-earth-map-square.png"
$textureReference = "../assets/flat-earth-map.png"

New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

$objPath = Join-Path $modelDir "flat-earth-disc.obj"
$mtlPath = Join-Path $modelDir "flat-earth-disc.mtl"

function New-SquareTexture {
  param(
    [string]$InputPath,
    [string]$OutputPath
  )

  Add-Type -AssemblyName System.Drawing

  $image = [System.Drawing.Image]::FromFile($InputPath)
  try {
    $side = [Math]::Min($image.Width, $image.Height)
    $sourceX = [int](($image.Width - $side) / 2)
    $sourceY = [int](($image.Height - $side) / 2)

    $bitmap = New-Object System.Drawing.Bitmap $side, $side
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Black)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $sourceRect = New-Object System.Drawing.Rectangle $sourceX, $sourceY, $side, $side
        $destRect = New-Object System.Drawing.Rectangle 0, 0, $side, $side
        $graphics.DrawImage($image, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
      }
      finally {
        $graphics.Dispose()
      }

      $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $bitmap.Dispose()
    }
  }
  finally {
    $image.Dispose()
  }
}

if (Test-Path $sourceTexturePath) {
  New-SquareTexture -InputPath $sourceTexturePath -OutputPath $squareTexturePath
  $textureReference = "../assets/flat-earth-map-square.png"
}

$radius = 5.0
$height = 0.36
$halfHeight = $height / 2.0
$tropicLatitude = 23.44

function Get-ProjectedRadius {
  param([double]$LatitudeDegrees)
  return $radius * ((90.0 - $LatitudeDegrees) / 180.0)
}

$segments = 128
$rimThickness = 0.28
$rimClearance = 0.08
$rimOuterRadius = $radius + $rimClearance
$rimInnerRadius = $rimOuterRadius - $rimThickness
$rimHeight = 0.62
$rimBottom = -0.02
$rimTop = $rimBottom + $rimHeight
$domeRadius = $rimInnerRadius - 0.14
$domeBaseY = 0.46
$domeSegments = 96
$domeRings = 24
$orbitTrackY = $domeBaseY + 2.01
$northTropicOrbitRadius = Get-ProjectedRadius $tropicLatitude
$equatorOrbitRadius = Get-ProjectedRadius 0.0
$southTropicOrbitRadius = Get-ProjectedRadius (-$tropicLatitude)
$orbitTrackTubeRadius = 0.026
$orbitTrackSegments = 96
$orbitTrackTubeSegments = 12
$sunOrbitRadius = $northTropicOrbitRadius
$sunOrbitHeight = $orbitTrackY + 0.04
$sunRadius = 0.18
$sunSegments = 32
$sunRings = 16

$vertices = [System.Collections.Generic.List[double[]]]::new()
$uvs = [System.Collections.Generic.List[double[]]]::new()
$normals = [System.Collections.Generic.List[double[]]]::new()
$faces = [System.Collections.Generic.List[string]]::new()

function Add-Vertex {
  param([double]$x, [double]$y, [double]$z)
  $script:vertices.Add(@($x, $y, $z))
  return $script:vertices.Count
}

function Add-UV {
  param([double]$u, [double]$v)
  $script:uvs.Add(@($u, $v))
  return $script:uvs.Count
}

function Add-Normal {
  param([double]$x, [double]$y, [double]$z)
  $script:normals.Add(@($x, $y, $z))
  return $script:normals.Count
}

function Add-Face {
  param([string]$line)
  $script:faces.Add($line)
}

function New-TorusMesh {
  param(
    [double]$MajorRadius,
    [double]$MinorRadius,
    [double]$CenterY,
    [int]$RadialSegments,
    [int]$TubeSegments
  )

  $torusVertices = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()
  $torusUvs = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()
  $torusNormals = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()

  for ($ring = 0; $ring -le $RadialSegments; $ring++) {
    $uAngle = ([Math]::PI * 2.0) * ($ring / $RadialSegments)
    $cosU = [Math]::Cos($uAngle)
    $sinU = [Math]::Sin($uAngle)
    $ringVertexIndices = [System.Collections.Generic.List[int]]::new()
    $ringUvIndices = [System.Collections.Generic.List[int]]::new()
    $ringNormalIndices = [System.Collections.Generic.List[int]]::new()

    for ($segment = 0; $segment -le $TubeSegments; $segment++) {
      $vAngle = ([Math]::PI * 2.0) * ($segment / $TubeSegments)
      $cosV = [Math]::Cos($vAngle)
      $sinV = [Math]::Sin($vAngle)

      $normalX = $cosU * $cosV
      $normalY = $sinV
      $normalZ = $sinU * $cosV

      $x = ($MajorRadius + ($MinorRadius * $cosV)) * $cosU
      $y = $CenterY + ($MinorRadius * $sinV)
      $z = ($MajorRadius + ($MinorRadius * $cosV)) * $sinU
      $u = $ring / $RadialSegments
      $v = $segment / $TubeSegments

      $ringVertexIndices.Add((Add-Vertex $x $y $z)) | Out-Null
      $ringUvIndices.Add((Add-UV $u $v)) | Out-Null
      $ringNormalIndices.Add((Add-Normal $normalX $normalY $normalZ)) | Out-Null
    }

    $torusVertices.Add($ringVertexIndices) | Out-Null
    $torusUvs.Add($ringUvIndices) | Out-Null
    $torusNormals.Add($ringNormalIndices) | Out-Null
  }

  return @{
    Vertices = $torusVertices
    Uvs = $torusUvs
    Normals = $torusNormals
  }
}

function Add-QuadStripFaces {
  param(
    [System.Collections.Generic.List[string]]$TargetLines,
    $VertexGrid,
    $UvGrid,
    $NormalGrid,
    [int]$RingCount,
    [int]$SegmentCount
  )

  for ($ring = 0; $ring -lt $RingCount; $ring++) {
    for ($segment = 0; $segment -lt $SegmentCount; $segment++) {
      $a = $VertexGrid[$ring][$segment]
      $b = $VertexGrid[$ring + 1][$segment]
      $c = $VertexGrid[$ring + 1][$segment + 1]
      $d = $VertexGrid[$ring][$segment + 1]

      $ua = $UvGrid[$ring][$segment]
      $ub = $UvGrid[$ring + 1][$segment]
      $uc = $UvGrid[$ring + 1][$segment + 1]
      $ud = $UvGrid[$ring][$segment + 1]

      $na = $NormalGrid[$ring][$segment]
      $nb = $NormalGrid[$ring + 1][$segment]
      $nc = $NormalGrid[$ring + 1][$segment + 1]
      $nd = $NormalGrid[$ring][$segment + 1]

      $TargetLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
        $a, $ua, $na, `
        $b, $ub, $nb, `
        $c, $uc, $nc)) | Out-Null
      $TargetLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
        $a, $ua, $na, `
        $c, $uc, $nc, `
        $d, $ud, $nd)) | Out-Null
    }
  }
}

$topNormal = Add-Normal 0 1 0
$bottomNormal = Add-Normal 0 -1 0

$topCenterVertex = Add-Vertex 0 $halfHeight 0
$topCenterUV = Add-UV 0.5 0.5
$topRingVertices = [System.Collections.Generic.List[int]]::new()
$topRingUVs = [System.Collections.Generic.List[int]]::new()

for ($i = 0; $i -lt $segments; $i++) {
  $angle = ([Math]::PI * 2.0 * $i) / $segments
  $x = [Math]::Cos($angle) * $radius
  $z = [Math]::Sin($angle) * $radius
  $u = 0.5 + (($x / $radius) * 0.5)
  $v = 0.5 + (($z / $radius) * 0.5)
  $topRingVertices.Add((Add-Vertex $x $halfHeight $z)) | Out-Null
  $topRingUVs.Add((Add-UV $u $v)) | Out-Null
}

$bottomCenterVertex = Add-Vertex 0 (-$halfHeight) 0
$bottomCenterUV = Add-UV 0.5 0.5
$bottomRingVertices = [System.Collections.Generic.List[int]]::new()
$bottomRingUVs = [System.Collections.Generic.List[int]]::new()

for ($i = 0; $i -lt $segments; $i++) {
  $angle = ([Math]::PI * 2.0 * $i) / $segments
  $x = [Math]::Cos($angle) * $radius
  $z = [Math]::Sin($angle) * $radius
  $u = 0.5 + (($x / $radius) * 0.5)
  $v = 0.5 - (($z / $radius) * 0.5)
  $bottomRingVertices.Add((Add-Vertex $x (-$halfHeight) $z)) | Out-Null
  $bottomRingUVs.Add((Add-UV $u $v)) | Out-Null
}

$sideTopVertices = [System.Collections.Generic.List[int]]::new()
$sideBottomVertices = [System.Collections.Generic.List[int]]::new()
$sideTopUVs = [System.Collections.Generic.List[int]]::new()
$sideBottomUVs = [System.Collections.Generic.List[int]]::new()
$sideNormals = [System.Collections.Generic.List[int]]::new()

for ($i = 0; $i -lt $segments; $i++) {
  $angle = ([Math]::PI * 2.0 * $i) / $segments
  $x = [Math]::Cos($angle) * $radius
  $z = [Math]::Sin($angle) * $radius
  $u = $i / $segments
  $sideNormals.Add((Add-Normal ([Math]::Cos($angle)) 0 ([Math]::Sin($angle)))) | Out-Null
  $sideTopVertices.Add((Add-Vertex $x $halfHeight $z)) | Out-Null
  $sideBottomVertices.Add((Add-Vertex $x (-$halfHeight) $z)) | Out-Null
  $sideTopUVs.Add((Add-UV $u 1)) | Out-Null
  $sideBottomUVs.Add((Add-UV $u 0)) | Out-Null
}

$rimOuterNormals = [System.Collections.Generic.List[int]]::new()
$rimInnerNormals = [System.Collections.Generic.List[int]]::new()
$rimOuterTopVertices = [System.Collections.Generic.List[int]]::new()
$rimOuterBottomVertices = [System.Collections.Generic.List[int]]::new()
$rimInnerTopVertices = [System.Collections.Generic.List[int]]::new()
$rimInnerBottomVertices = [System.Collections.Generic.List[int]]::new()
$rimOuterTopUVs = [System.Collections.Generic.List[int]]::new()
$rimOuterBottomUVs = [System.Collections.Generic.List[int]]::new()
$rimInnerTopUVs = [System.Collections.Generic.List[int]]::new()
$rimInnerBottomUVs = [System.Collections.Generic.List[int]]::new()

for ($i = 0; $i -lt $segments; $i++) {
  $angle = ([Math]::PI * 2.0 * $i) / $segments
  $cos = [Math]::Cos($angle)
  $sin = [Math]::Sin($angle)
  $u = $i / $segments

  $rimOuterNormals.Add((Add-Normal $cos 0 $sin)) | Out-Null
  $rimInnerNormals.Add((Add-Normal (-$cos) 0 (-$sin))) | Out-Null

  $outerX = $cos * $rimOuterRadius
  $outerZ = $sin * $rimOuterRadius
  $innerX = $cos * $rimInnerRadius
  $innerZ = $sin * $rimInnerRadius

  $rimOuterTopVertices.Add((Add-Vertex $outerX $rimTop $outerZ)) | Out-Null
  $rimOuterBottomVertices.Add((Add-Vertex $outerX $rimBottom $outerZ)) | Out-Null
  $rimInnerTopVertices.Add((Add-Vertex $innerX $rimTop $innerZ)) | Out-Null
  $rimInnerBottomVertices.Add((Add-Vertex $innerX $rimBottom $innerZ)) | Out-Null

  $rimOuterTopUVs.Add((Add-UV $u 1)) | Out-Null
  $rimOuterBottomUVs.Add((Add-UV $u 0)) | Out-Null
  $rimInnerTopUVs.Add((Add-UV $u 1)) | Out-Null
  $rimInnerBottomUVs.Add((Add-UV $u 0)) | Out-Null
}

$rimTopNormal = Add-Normal 0 1 0
$rimBottomNormal = Add-Normal 0 -1 0
$rimInnerUvScale = 0.5 * ($rimInnerRadius / $rimOuterRadius)
$rimTopOuterUVs = [System.Collections.Generic.List[int]]::new()
$rimTopInnerUVs = [System.Collections.Generic.List[int]]::new()
$rimBottomOuterUVs = [System.Collections.Generic.List[int]]::new()
$rimBottomInnerUVs = [System.Collections.Generic.List[int]]::new()

for ($i = 0; $i -lt $segments; $i++) {
  $angle = ([Math]::PI * 2.0 * $i) / $segments
  $cos = [Math]::Cos($angle)
  $sin = [Math]::Sin($angle)
  $rimTopOuterUVs.Add((Add-UV (0.5 + $cos * 0.5) (0.5 + $sin * 0.5))) | Out-Null
  $rimTopInnerUVs.Add((Add-UV (0.5 + $cos * $rimInnerUvScale) (0.5 + $sin * $rimInnerUvScale))) | Out-Null
  $rimBottomOuterUVs.Add((Add-UV (0.5 + $cos * 0.5) (0.5 - $sin * 0.5))) | Out-Null
  $rimBottomInnerUVs.Add((Add-UV (0.5 + $cos * $rimInnerUvScale) (0.5 - $sin * $rimInnerUvScale))) | Out-Null
}

$domeVertices = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()
$domeUvs = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()
$domeNormals = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()

for ($ring = 0; $ring -le $domeRings; $ring++) {
  $phi = ([Math]::PI / 2.0) * ($ring / $domeRings)
  $ringVertexIndices = [System.Collections.Generic.List[int]]::new()
  $ringUvIndices = [System.Collections.Generic.List[int]]::new()
  $ringNormalIndices = [System.Collections.Generic.List[int]]::new()

  for ($segment = 0; $segment -le $domeSegments; $segment++) {
    $theta = ([Math]::PI * 2.0) * ($segment / $domeSegments)
    $sinPhi = [Math]::Sin($phi)
    $cosPhi = [Math]::Cos($phi)
    $cosTheta = [Math]::Cos($theta)
    $sinTheta = [Math]::Sin($theta)

    $normalX = $sinPhi * $cosTheta
    $normalY = $cosPhi
    $normalZ = $sinPhi * $sinTheta

    $x = $normalX * $domeRadius
    $y = $domeBaseY + ($normalY * $domeRadius)
    $z = $normalZ * $domeRadius
    $u = $segment / $domeSegments
    $v = 1.0 - ($ring / $domeRings)

    $ringVertexIndices.Add((Add-Vertex $x $y $z)) | Out-Null
    $ringUvIndices.Add((Add-UV $u $v)) | Out-Null
    $ringNormalIndices.Add((Add-Normal $normalX $normalY $normalZ)) | Out-Null
  }

  $domeVertices.Add($ringVertexIndices) | Out-Null
  $domeUvs.Add($ringUvIndices) | Out-Null
  $domeNormals.Add($ringNormalIndices) | Out-Null
}

$sunVertices = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()
$sunUvs = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()
$sunNormals = [System.Collections.Generic.List[System.Collections.Generic.List[int]]]::new()
$sunCenterX = $sunOrbitRadius
$sunCenterY = $sunOrbitHeight
$sunCenterZ = 0.0

for ($ring = 0; $ring -le $sunRings; $ring++) {
  $phi = [Math]::PI * ($ring / $sunRings)
  $ringVertexIndices = [System.Collections.Generic.List[int]]::new()
  $ringUvIndices = [System.Collections.Generic.List[int]]::new()
  $ringNormalIndices = [System.Collections.Generic.List[int]]::new()

  for ($segment = 0; $segment -le $sunSegments; $segment++) {
    $theta = ([Math]::PI * 2.0) * ($segment / $sunSegments)
    $sinPhi = [Math]::Sin($phi)
    $cosPhi = [Math]::Cos($phi)
    $cosTheta = [Math]::Cos($theta)
    $sinTheta = [Math]::Sin($theta)

    $normalX = $sinPhi * $cosTheta
    $normalY = $cosPhi
    $normalZ = $sinPhi * $sinTheta

    $x = $sunCenterX + ($normalX * $sunRadius)
    $y = $sunCenterY + ($normalY * $sunRadius)
    $z = $sunCenterZ + ($normalZ * $sunRadius)
    $u = $segment / $sunSegments
    $v = 1.0 - ($ring / $sunRings)

    $ringVertexIndices.Add((Add-Vertex $x $y $z)) | Out-Null
    $ringUvIndices.Add((Add-UV $u $v)) | Out-Null
    $ringNormalIndices.Add((Add-Normal $normalX $normalY $normalZ)) | Out-Null
  }

  $sunVertices.Add($ringVertexIndices) | Out-Null
  $sunUvs.Add($ringUvIndices) | Out-Null
  $sunNormals.Add($ringNormalIndices) | Out-Null
}

$northTropicTrack = New-TorusMesh -MajorRadius $northTropicOrbitRadius -MinorRadius $orbitTrackTubeRadius -CenterY $orbitTrackY -RadialSegments $orbitTrackSegments -TubeSegments $orbitTrackTubeSegments
$equatorTrack = New-TorusMesh -MajorRadius $equatorOrbitRadius -MinorRadius $orbitTrackTubeRadius -CenterY $orbitTrackY -RadialSegments $orbitTrackSegments -TubeSegments $orbitTrackTubeSegments
$southTropicTrack = New-TorusMesh -MajorRadius $southTropicOrbitRadius -MinorRadius $orbitTrackTubeRadius -CenterY $orbitTrackY -RadialSegments $orbitTrackSegments -TubeSegments $orbitTrackTubeSegments

Add-Face "mtllib flat-earth-disc.mtl"
Add-Face "o FlatEarthDisc"
Add-Face "g TopSurface"
Add-Face "usemtl TopSurface"

for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $topCenterVertex, $topCenterUV, $topNormal, `
    $topRingVertices[$i], $topRingUVs[$i], `
    $topRingVertices[$next], $topRingUVs[$next])
}

Add-Face "g BottomSurface"
Add-Face "usemtl BottomSurface"

for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $bottomCenterVertex, $bottomCenterUV, $bottomNormal, `
    $bottomRingVertices[$next], $bottomRingUVs[$next], `
    $bottomRingVertices[$i], $bottomRingUVs[$i])
}

Add-Face "g SideWall"
Add-Face "usemtl SideWall"

for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments
  $normalA = $sideNormals[$i]
  $normalB = $sideNormals[$next]
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $sideTopVertices[$i], $sideTopUVs[$i], $normalA, `
    $sideBottomVertices[$i], $sideBottomUVs[$i], $normalA, `
    $sideBottomVertices[$next], $sideBottomUVs[$next], $normalB)
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $sideTopVertices[$i], $sideTopUVs[$i], $normalA, `
    $sideBottomVertices[$next], $sideBottomUVs[$next], $normalB, `
    $sideTopVertices[$next], $sideTopUVs[$next], $normalB)
}

Add-Face "g IceRim"
Add-Face "usemtl IceRim"

for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments

  $outerNormalA = $rimOuterNormals[$i]
  $outerNormalB = $rimOuterNormals[$next]
  $innerNormalA = $rimInnerNormals[$i]
  $innerNormalB = $rimInnerNormals[$next]

  Add-Face ("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{7}" -f `
    $rimOuterTopVertices[$i], $rimOuterTopUVs[$i], $outerNormalA, `
    $rimOuterBottomVertices[$i], $rimOuterBottomUVs[$i], `
    $rimOuterBottomVertices[$next], $rimOuterBottomUVs[$next], $outerNormalB)
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $rimOuterTopVertices[$i], $rimOuterTopUVs[$i], $outerNormalA, `
    $rimOuterBottomVertices[$next], $rimOuterBottomUVs[$next], $outerNormalB, `
    $rimOuterTopVertices[$next], $rimOuterTopUVs[$next], $outerNormalB)

  Add-Face ("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $rimInnerTopVertices[$i], $rimInnerTopUVs[$i], $innerNormalA, `
    $rimInnerBottomVertices[$next], $rimInnerBottomUVs[$next], $innerNormalB, `
    $rimInnerBottomVertices[$i], $rimInnerBottomUVs[$i], $innerNormalA)
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $rimInnerTopVertices[$i], $rimInnerTopUVs[$i], $innerNormalA, `
    $rimInnerTopVertices[$next], $rimInnerTopUVs[$next], $innerNormalB, `
    $rimInnerBottomVertices[$next], $rimInnerBottomUVs[$next], $innerNormalB)

  Add-Face ("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerTopVertices[$i], $rimTopInnerUVs[$i], $rimTopNormal, `
    $rimOuterTopVertices[$i], $rimTopOuterUVs[$i], `
    $rimOuterTopVertices[$next], $rimTopOuterUVs[$next])
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerTopVertices[$i], $rimTopInnerUVs[$i], $rimTopNormal, `
    $rimOuterTopVertices[$next], $rimTopOuterUVs[$next], `
    $rimInnerTopVertices[$next], $rimTopInnerUVs[$next])

  Add-Face ("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerBottomVertices[$i], $rimBottomInnerUVs[$i], $rimBottomNormal, `
    $rimOuterBottomVertices[$next], $rimBottomOuterUVs[$next], `
    $rimOuterBottomVertices[$i], $rimBottomOuterUVs[$i])
  Add-Face ("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerBottomVertices[$i], $rimBottomInnerUVs[$i], $rimBottomNormal, `
    $rimInnerBottomVertices[$next], $rimBottomInnerUVs[$next], `
    $rimOuterBottomVertices[$next], $rimBottomOuterUVs[$next])
}

$objLines = [System.Collections.Generic.List[string]]::new()
foreach ($face in $faces) {
  if ($face.StartsWith("v ") -or $face.StartsWith("vt ") -or $face.StartsWith("vn ")) {
    continue
  }
}

$objLines.Add("mtllib flat-earth-disc.mtl") | Out-Null
$objLines.Add("o FlatEarthDisc") | Out-Null

foreach ($vertex in $vertices) {
  $objLines.Add(("v {0:F6} {1:F6} {2:F6}" -f $vertex[0], $vertex[1], $vertex[2])) | Out-Null
}
foreach ($uv in $uvs) {
  $objLines.Add(("vt {0:F6} {1:F6}" -f $uv[0], $uv[1])) | Out-Null
}
foreach ($normal in $normals) {
  $objLines.Add(("vn {0:F6} {1:F6} {2:F6}" -f $normal[0], $normal[1], $normal[2])) | Out-Null
}

$objLines.Add("g TopSurface") | Out-Null
$objLines.Add("usemtl TopSurface") | Out-Null
for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $topCenterVertex, $topCenterUV, $topNormal, `
    $topRingVertices[$i], $topRingUVs[$i], `
    $topRingVertices[$next], $topRingUVs[$next])) | Out-Null
}

$objLines.Add("g BottomSurface") | Out-Null
$objLines.Add("usemtl BottomSurface") | Out-Null
for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $bottomCenterVertex, $bottomCenterUV, $bottomNormal, `
    $bottomRingVertices[$next], $bottomRingUVs[$next], `
    $bottomRingVertices[$i], $bottomRingUVs[$i])) | Out-Null
}

$objLines.Add("g SideWall") | Out-Null
$objLines.Add("usemtl SideWall") | Out-Null
for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments
  $normalA = $sideNormals[$i]
  $normalB = $sideNormals[$next]
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $sideTopVertices[$i], $sideTopUVs[$i], $normalA, `
    $sideBottomVertices[$i], $sideBottomUVs[$i], $normalA, `
    $sideBottomVertices[$next], $sideBottomUVs[$next], $normalB)) | Out-Null
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $sideTopVertices[$i], $sideTopUVs[$i], $normalA, `
    $sideBottomVertices[$next], $sideBottomUVs[$next], $normalB, `
    $sideTopVertices[$next], $sideTopUVs[$next], $normalB)) | Out-Null
}

$objLines.Add("g IceRim") | Out-Null
$objLines.Add("usemtl IceRim") | Out-Null
for ($i = 0; $i -lt $segments; $i++) {
  $next = ($i + 1) % $segments

  $outerNormalA = $rimOuterNormals[$i]
  $outerNormalB = $rimOuterNormals[$next]
  $innerNormalA = $rimInnerNormals[$i]
  $innerNormalB = $rimInnerNormals[$next]

  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{7}" -f `
    $rimOuterTopVertices[$i], $rimOuterTopUVs[$i], $outerNormalA, `
    $rimOuterBottomVertices[$i], $rimOuterBottomUVs[$i], `
    $rimOuterBottomVertices[$next], $rimOuterBottomUVs[$next], $outerNormalB)) | Out-Null
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $rimOuterTopVertices[$i], $rimOuterTopUVs[$i], $outerNormalA, `
    $rimOuterBottomVertices[$next], $rimOuterBottomUVs[$next], $outerNormalB, `
    $rimOuterTopVertices[$next], $rimOuterTopUVs[$next], $outerNormalB)) | Out-Null

  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $rimInnerTopVertices[$i], $rimInnerTopUVs[$i], $innerNormalA, `
    $rimInnerBottomVertices[$next], $rimInnerBottomUVs[$next], $innerNormalB, `
    $rimInnerBottomVertices[$i], $rimInnerBottomUVs[$i], $innerNormalA)) | Out-Null
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
    $rimInnerTopVertices[$i], $rimInnerTopUVs[$i], $innerNormalA, `
    $rimInnerTopVertices[$next], $rimInnerTopUVs[$next], $innerNormalB, `
    $rimInnerBottomVertices[$next], $rimInnerBottomUVs[$next], $innerNormalB)) | Out-Null

  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerTopVertices[$i], $rimTopInnerUVs[$i], $rimTopNormal, `
    $rimOuterTopVertices[$i], $rimTopOuterUVs[$i], `
    $rimOuterTopVertices[$next], $rimTopOuterUVs[$next])) | Out-Null
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerTopVertices[$i], $rimTopInnerUVs[$i], $rimTopNormal, `
    $rimOuterTopVertices[$next], $rimTopOuterUVs[$next], `
    $rimInnerTopVertices[$next], $rimTopInnerUVs[$next])) | Out-Null

  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerBottomVertices[$i], $rimBottomInnerUVs[$i], $rimBottomNormal, `
    $rimOuterBottomVertices[$next], $rimBottomOuterUVs[$next], `
    $rimOuterBottomVertices[$i], $rimBottomOuterUVs[$i])) | Out-Null
  $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{2} {5}/{6}/{2}" -f `
    $rimInnerBottomVertices[$i], $rimBottomInnerUVs[$i], $rimBottomNormal, `
    $rimInnerBottomVertices[$next], $rimBottomInnerUVs[$next], `
    $rimOuterBottomVertices[$next], $rimBottomOuterUVs[$next])) | Out-Null
}

$objLines.Add("g DomeGlass") | Out-Null
$objLines.Add("usemtl DomeGlass") | Out-Null
for ($ring = 0; $ring -lt $domeRings; $ring++) {
  for ($segment = 0; $segment -lt $domeSegments; $segment++) {
    $a = $domeVertices[$ring][$segment]
    $b = $domeVertices[$ring + 1][$segment]
    $c = $domeVertices[$ring + 1][$segment + 1]
    $d = $domeVertices[$ring][$segment + 1]

    $ua = $domeUvs[$ring][$segment]
    $ub = $domeUvs[$ring + 1][$segment]
    $uc = $domeUvs[$ring + 1][$segment + 1]
    $ud = $domeUvs[$ring][$segment + 1]

    $na = $domeNormals[$ring][$segment]
    $nb = $domeNormals[$ring + 1][$segment]
    $nc = $domeNormals[$ring + 1][$segment + 1]
    $nd = $domeNormals[$ring][$segment + 1]

    $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
      $a, $ua, $na, `
      $b, $ub, $nb, `
      $c, $uc, $nc)) | Out-Null
    $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
      $a, $ua, $na, `
      $c, $uc, $nc, `
      $d, $ud, $nd)) | Out-Null
  }
}

$objLines.Add("g OrbitNorthTropic") | Out-Null
$objLines.Add("usemtl OrbitNorthTropic") | Out-Null
Add-QuadStripFaces -TargetLines $objLines -VertexGrid $northTropicTrack.Vertices -UvGrid $northTropicTrack.Uvs -NormalGrid $northTropicTrack.Normals -RingCount $orbitTrackSegments -SegmentCount $orbitTrackTubeSegments

$objLines.Add("g OrbitEquator") | Out-Null
$objLines.Add("usemtl OrbitEquator") | Out-Null
Add-QuadStripFaces -TargetLines $objLines -VertexGrid $equatorTrack.Vertices -UvGrid $equatorTrack.Uvs -NormalGrid $equatorTrack.Normals -RingCount $orbitTrackSegments -SegmentCount $orbitTrackTubeSegments

$objLines.Add("g OrbitSouthTropic") | Out-Null
$objLines.Add("usemtl OrbitSouthTropic") | Out-Null
Add-QuadStripFaces -TargetLines $objLines -VertexGrid $southTropicTrack.Vertices -UvGrid $southTropicTrack.Uvs -NormalGrid $southTropicTrack.Normals -RingCount $orbitTrackSegments -SegmentCount $orbitTrackTubeSegments

$objLines.Add("g SunBody") | Out-Null
$objLines.Add("usemtl SunLight") | Out-Null
for ($ring = 0; $ring -lt $sunRings; $ring++) {
  for ($segment = 0; $segment -lt $sunSegments; $segment++) {
    $a = $sunVertices[$ring][$segment]
    $b = $sunVertices[$ring + 1][$segment]
    $c = $sunVertices[$ring + 1][$segment + 1]
    $d = $sunVertices[$ring][$segment + 1]

    $ua = $sunUvs[$ring][$segment]
    $ub = $sunUvs[$ring + 1][$segment]
    $uc = $sunUvs[$ring + 1][$segment + 1]
    $ud = $sunUvs[$ring][$segment + 1]

    $na = $sunNormals[$ring][$segment]
    $nb = $sunNormals[$ring + 1][$segment]
    $nc = $sunNormals[$ring + 1][$segment + 1]
    $nd = $sunNormals[$ring][$segment + 1]

    $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
      $a, $ua, $na, `
      $b, $ub, $nb, `
      $c, $uc, $nc)) | Out-Null
    $objLines.Add(("f {0}/{1}/{2} {3}/{4}/{5} {6}/{7}/{8}" -f `
      $a, $ua, $na, `
      $c, $uc, $nc, `
      $d, $ud, $nd)) | Out-Null
  }
}

[System.IO.File]::WriteAllLines($objPath, $objLines)

$mtlLines = @(
  "newmtl TopSurface",
  "Ka 1.000000 1.000000 1.000000",
  "Kd 1.000000 1.000000 1.000000",
  "Ks 0.050000 0.050000 0.050000",
  "Ns 16.000000",
  "map_Kd $textureReference",
  "",
  "newmtl SideWall",
  "Ka 0.090000 0.110000 0.130000",
  "Kd 0.130000 0.180000 0.230000",
  "Ks 0.020000 0.020000 0.020000",
  "Ns 4.000000",
  "",
  "newmtl BottomSurface",
  "Ka 0.050000 0.060000 0.070000",
  "Kd 0.060000 0.090000 0.120000",
  "Ks 0.020000 0.020000 0.020000",
  "Ns 4.000000",
  "",
  "newmtl IceRim",
  "Ka 0.900000 0.930000 0.960000",
  "Kd 0.960000 0.980000 1.000000",
  "Ks 0.150000 0.150000 0.150000",
  "Ns 24.000000",
  "",
  "newmtl DomeGlass",
  "Ka 0.200000 0.280000 0.340000",
  "Kd 0.620000 0.830000 0.980000",
  "Ks 0.350000 0.350000 0.350000",
  "Ns 96.000000",
  "d 0.320000",
  "illum 4",
  "",
  "newmtl OrbitNorthTropic",
  "Ka 0.880000 0.640000 0.240000",
  "Kd 1.000000 0.790000 0.350000",
  "Ks 0.120000 0.120000 0.120000",
  "Ns 24.000000",
  "illum 2",
  "",
  "newmtl OrbitEquator",
  "Ka 0.320000 0.700000 0.860000",
  "Kd 0.500000 0.860000 1.000000",
  "Ks 0.120000 0.120000 0.120000",
  "Ns 24.000000",
  "illum 2",
  "",
  "newmtl OrbitSouthTropic",
  "Ka 0.820000 0.380000 0.560000",
  "Kd 1.000000 0.580000 0.720000",
  "Ks 0.120000 0.120000 0.120000",
  "Ns 24.000000",
  "illum 2",
  "",
  "newmtl SunLight",
  "Ka 1.000000 0.720000 0.220000",
  "Kd 1.000000 0.840000 0.360000",
  "Ks 0.500000 0.400000 0.150000",
  "Ns 64.000000",
  "illum 2"
)
[System.IO.File]::WriteAllLines($mtlPath, $mtlLines)

Write-Host "Generated:"
Write-Host " - $objPath"
Write-Host " - $mtlPath"
if (Test-Path $squareTexturePath) {
  Write-Host " - $squareTexturePath"
}

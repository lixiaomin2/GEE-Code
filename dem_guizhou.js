// 贵州省石漠化分级图自动生成（GEE直接运行，论文专用）
// ===========================================================

// 1. 研究区：贵州省（GEE公共边界，无需上传）
var guizhou = ee.FeatureCollection('users/weizw09/China/Guizhou');
Map.centerObject(guizhou, 7);

// 2. 云掩膜
function maskClouds(image) {
  var qa = image.select('QA_PIXEL');
  var cloud = qa.bitwiseAnd(1 << 3).eq(0);
  var shadow = qa.bitwiseAnd(1 << 4).eq(0);
  return image.updateMask(cloud.and(shadow)).clip(guizhou);
}

// 3. 加载Landsat 8 2020年数据（石漠化基准年）
var img = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterDate('2020-01-01', '2020-12-31')
  .filter(ee.Filter.calendarRange(4, 11, 'month'))
  .map(maskClouds)
  .median();

// 4. 计算 NDVI（植被指数）
var ndvi = img.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');

// 5. 计算植被覆盖度 VFC（石漠化核心指标）
var min = ndvi.reduceRegion({
  reducer: ee.Reducer.min(), geometry: guizhou, scale: 30, maxPixels: 1e13
}).values().get(0);

var max = ndvi.reduceRegion({
  reducer: ee.Reducer.max(), geometry: guizhou, scale: 30, maxPixels: 1e13
}).values().get(0);

var vfc = ndvi.subtract(min).divide(max.subtract(min)).rename('VFC');

// 6. 石漠化分级（国家标准）
var rocky = ee.Image(0)
  .where(vfc.lte(0.10), 5)    // 极重度  5
  .where(vfc.gt(0.10).and(vfc.lte(0.20)), 4) // 重度 4
  .where(vfc.gt(0.20).and(vfc.lte(0.35)), 3) // 中度 3
  .where(vfc.gt(0.35).and(vfc.lte(0.50)), 2) // 轻度 2
  .where(vfc.gt(0.50).and(vfc.lte(0.70)), 1) // 潜在 1
  .where(vfc.gt(0.70), 0)    // 无石漠化 0
  .rename('rocky_desert');

// 7. 显示石漠化图
var vis = {min:0, max:5, palette:[
  'green',      // 0 无
  'yellow',     // 1 潜在
  'orange',     // 2 轻度
  'darkorange', // 3 中度
  'red',        // 4 重度
  'darkred'     // 5 极重度
]};

Map.addLayer(rocky, vis, '贵州省石漠化分级图');

// 8. 导出到Google Drive（30m分辨率，论文可用）
Export.image.toDrive({
  image: rocky,
  description: 'Guizhou_Rocky_Desert_2020',
  scale: 30,
  region: guizhou,
  maxPixels: 1e13,
  crs: 'EPSG:4326'
});

// 输出石漠化面积统计
print('石漠化分级统计', rocky.reduceRegion({
  reducer: ee.Reducer.frequencyHistogram(),
  geometry: guizhou,
  scale: 30,
  maxPixels: 1e13
}));

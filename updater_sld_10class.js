import fs from 'fs';

// 10级颜色方案配置 (ColorBrewer 标准连续色带 - 符合制图规范)
const colorRamps = {
  // 耕地：YlOrBr (经典农业色带，从浅黄到深褐，清晰表达密度)
  cropland: ['#ffffd4', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506', '#441203', '#2a0a01'],

  // 林地：Greens (自然植被，从浅绿到墨绿)
  forest: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b', '#00220e'],

  // 灌木：YlGn (黄绿渐变，区分于森林的纯绿)
  shrub: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529', '#002518'],

  // 草地：YlGnBu (黄/绿/蓝渐变，清新且有层次)
  grassland: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58', '#040e2c', '#020716'],

  // 水体：Blues (标准浅蓝到深蓝)
  water: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b', '#041533'],

  // 湿地：GnBu (青绿到深蓝，体现水草结合)
  wetland: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#042040'],

  // 建设用地：Reds (从白到深红，高对比警示色)
  impervious: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d', '#330006'],

  // 裸地：Greys (中性灰，从白到黑)
  barren: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000', '#000000'],

  // 冰雪：PuBu (凉爽的紫蓝渐变)
  snow_ice: ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858', '#011c2c']
};

const attributes = ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'];

const geoserverUrl = 'http://localhost:8080/geoserver/rest/workspaces/WebGIS/styles';
const auth = 'Basic ' + Buffer.from('admin:geoserver').toString('base64');

async function updateSlds() {
  for (const attr of attributes) {
    const sldName = `${attr}_dynamic`;
    const colors = colorRamps[attr] || colorRamps.cropland;

    console.log(`Generating SLD for ${attr}...`);
    const sldContent = generateSld(attr, sldName, colors);

    if (!fs.existsSync('geoserver_styles')) {
      fs.mkdirSync('geoserver_styles');
    }
    fs.writeFileSync(`geoserver_styles/${sldName}.sld`, sldContent);

    console.log(`Uploading ${sldName}...`);
    try {
      const url = `${geoserverUrl}/${sldName}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/vnd.ogc.sld+xml',
          'Authorization': auth
        },
        body: sldContent
      });

      if (res.ok) {
        console.log(`✅ Success: ${sldName}`);
      } else {
        if (res.status === 404) {
          const createRes = await fetch(geoserverUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/vnd.ogc.sld+xml',
              'Authorization': auth
            },
            body: sldContent
          });
          if (createRes.ok) console.log('✅ Created new style');
          else console.error('❌ Creation failed:', await createRes.text());
        } else {
          console.error(`❌ Failed: ${sldName} - ${res.status}`);
        }
      }
    } catch (e) {
      console.error('Error uploading:', e);
    }
  }
}

function generateSld(attrName, styleName, colors) {
  let rules = '';

  // Rule 1: < th1
  rules += `
        <Rule><Name>1</Name>
          <ogc:Filter><ogc:PropertyIsLessThan>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="env"><ogc:Literal>th1</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
          </ogc:PropertyIsLessThan></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">${colors[0]}</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>`;

  // Rules 2 to 9: >= th(i-1) AND < th(i)
  for (let i = 2; i <= 9; i++) {
    rules += `
        <Rule><Name>${i}</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th${i - 1}</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th${i}</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">${colors[i - 1]}</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>`;
  }

  // Rule 10: >= th9
  rules += `
        <Rule><Name>10</Name>
          <ogc:Filter><ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="env"><ogc:Literal>th9</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
          </ogc:PropertyIsGreaterThanOrEqualTo></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">${colors[9]}</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0">
  <NamedLayer>
    <Name>${styleName}</Name>
    <UserStyle>
      <Name>${styleName}</Name>
      <Title>${attrName} 10-Class Dynamic</Title>
      <FeatureTypeStyle>
        ${rules}
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
}

updateSlds();

import fs from 'fs';

// 差值分析专用 SLD 模板生成器
// 使用两列相减的逻辑：Value = Field2 (Year2) - Field1 (Year1)
// 颜色方案：RdBu (Red-Blue Diverging) 
// 负值 (减少) -> Blue
// 正值 (增加) -> Red

const styleName = 'difference_template';
const geoserverUrl = 'http://localhost:8080/geoserver/rest/workspaces/WebGIS/styles';
const auth = 'Basic ' + Buffer.from('admin:geoserver').toString('base64');

const colors = [
  '#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', // Blues
  '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'  // Reds
];

function generateDiffSld() {
  let rules = '';

  // 动态属性值：val = f2 - f1
  const diffFunction = `
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    `;

  // Rule 1: < th1
  rules += `
        <Rule><Name>1</Name>
          <ogc:Filter><ogc:PropertyIsLessThan>
            ${diffFunction}
            <ogc:Function name="env"><ogc:Literal>th1</ogc:Literal><ogc:Literal>-999999</ogc:Literal></ogc:Function>
          </ogc:PropertyIsLessThan></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">${colors[0]}</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.1</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>`;

  // Rules 2 to 9: >= th(i-1) AND < th(i)
  for (let i = 2; i <= 9; i++) {
    rules += `
        <Rule><Name>${i}</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              ${diffFunction}
              <ogc:Function name="env"><ogc:Literal>th${i - 1}</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              ${diffFunction}
              <ogc:Function name="env"><ogc:Literal>th${i}</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">${colors[i - 1]}</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.1</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>`;
  }

  // Rule 10: >= th9
  rules += `
        <Rule><Name>10</Name>
          <ogc:Filter><ogc:PropertyIsGreaterThanOrEqualTo>
            ${diffFunction}
            <ogc:Function name="env"><ogc:Literal>th9</ogc:Literal><ogc:Literal>999999</ogc:Literal></ogc:Function>
          </ogc:PropertyIsGreaterThanOrEqualTo></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">${colors[9]}</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.1</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0">
  <NamedLayer>
    <Name>${styleName}</Name>
    <UserStyle>
      <Name>${styleName}</Name>
      <Title>Difference Template (f2 - f1)</Title>
      <FeatureTypeStyle>
        ${rules}
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
}

async function upload() {
  const sldContent = generateDiffSld();

  if (!fs.existsSync('geoserver_styles')) fs.mkdirSync('geoserver_styles');
  fs.writeFileSync(`geoserver_styles/${styleName}.sld`, sldContent);
  console.log(`Saved geoserver_styles/${styleName}.sld`);

  // 1. DELETE
  try {
    const delUrl = `${geoserverUrl}/${styleName}?recurse=true`;
    console.log(`Deleting ${styleName}...`);
    await fetch(delUrl, {
      method: 'DELETE',
      headers: { 'Authorization': auth }
    });
  } catch (e) { }

  // 2. CREATE
  console.log(`Creating ${styleName}...`);
  try {
    const res = await fetch(geoserverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.ogc.sld+xml',
        // 'application/xml' checks? No, vnd.ogc.sld+xml is correct
        'Authorization': auth
      },
      body: sldContent
    });

    if (res.ok) {
      console.log(`✅ Created ${styleName}`);
    } else {
      console.error(`❌ Creation Failed: ${res.status}`);
      console.error(await res.text());
    }
  } catch (e) {
    console.error(e);
  }
}

upload();

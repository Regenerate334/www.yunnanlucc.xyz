<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0">
  <NamedLayer>
    <Name>grassland_dynamic</Name>
    <UserStyle>
      <Name>grassland_dynamic</Name>
      <Title>grassland 10-Class Dynamic</Title>
      <FeatureTypeStyle>
        
        <Rule><Name>1</Name>
          <ogc:Filter><ogc:PropertyIsLessThan>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="env"><ogc:Literal>th1</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
          </ogc:PropertyIsLessThan></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#ffffcc</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>2</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th1</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th2</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#c7e9b4</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>3</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th2</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th3</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#7fcdbb</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>4</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th3</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th4</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#41b6c4</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>5</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th4</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th5</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#1d91c0</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>6</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th5</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th6</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#225ea8</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>7</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th6</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th7</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#253494</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>8</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th7</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th8</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#081d58</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>9</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th8</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
              <ogc:Function name="env"><ogc:Literal>th9</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#040e2c</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>10</Name>
          <ogc:Filter><ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>attr</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="env"><ogc:Literal>th9</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
          </ogc:PropertyIsGreaterThanOrEqualTo></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#020716</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
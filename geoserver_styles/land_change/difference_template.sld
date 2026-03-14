<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0">
  <NamedLayer>
    <Name>difference_template</Name>
    <UserStyle>
      <Name>difference_template</Name>
      <Title>Difference Template (f2 - f1)</Title>
      <FeatureTypeStyle>
        
        <Rule><Name>1</Name>
          <ogc:Filter><ogc:PropertyIsLessThan>
            
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
            <ogc:Function name="env"><ogc:Literal>th1</ogc:Literal><ogc:Literal>-999999</ogc:Literal></ogc:Function>
          </ogc:PropertyIsLessThan></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#053061</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>2</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th1</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th2</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#2166ac</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>3</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th2</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th3</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#4393c3</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>4</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th3</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th4</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#92c5de</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>5</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th4</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th5</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#d1e5f0</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>6</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th5</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th6</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#fddbc7</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>7</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th6</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th7</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#f4a582</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>8</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th7</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th8</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#d6604d</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>9</Name>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th8</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan>
              
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
              <ogc:Function name="env"><ogc:Literal>th9</ogc:Literal><ogc:Literal>0</ogc:Literal></ogc:Function>
            </ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#b2182b</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
        <Rule><Name>10</Name>
          <ogc:Filter><ogc:PropertyIsGreaterThanOrEqualTo>
            
        <ogc:Sub>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f2</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
            <ogc:Function name="property"><ogc:Function name="env"><ogc:Literal>f1</ogc:Literal><ogc:Literal>val</ogc:Literal></ogc:Function></ogc:Function>
        </ogc:Sub>
    
            <ogc:Function name="env"><ogc:Literal>th9</ogc:Literal><ogc:Literal>999999</ogc:Literal></ogc:Function>
          </ogc:PropertyIsGreaterThanOrEqualTo></ogc:Filter>
          <PolygonSymbolizer><Fill><CssParameter name="fill">#67001f</CssParameter><CssParameter name="fill-opacity">1.0</CssParameter></Fill><Stroke><CssParameter name="stroke">#888888</CssParameter><CssParameter name="stroke-width">0.3</CssParameter></Stroke></PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
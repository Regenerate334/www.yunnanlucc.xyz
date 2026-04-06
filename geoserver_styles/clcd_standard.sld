<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" 
    xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" 
    xmlns="http://www.opengis.net/sld" 
    xmlns:ogc="http://www.opengis.net/ogc" 
    xmlns:xlink="http://www.w3.org/1999/xlink" 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>CLCD_Standard</Name>
    <UserStyle>
      <Title>CLCD Standard Classification</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <ColorMap type="values">
              <ColorMapEntry color="#000000" quantity="0" label="NoData" opacity="0.0" />
              <ColorMapEntry color="#FAE39C" quantity="1" label="Cropland" />
              <ColorMapEntry color="#446F33" quantity="2" label="Forest" />
              <ColorMapEntry color="#33A02C" quantity="3" label="Shrub" />
              <ColorMapEntry color="#ABD37B" quantity="4" label="Grassland" />
              <ColorMapEntry color="#1E69B4" quantity="5" label="Water" />
              <ColorMapEntry color="#A6CEE3" quantity="6" label="Snow/Ice" />
              <ColorMapEntry color="#CFBDA3" quantity="7" label="Barren" />
              <ColorMapEntry color="#E24290" quantity="8" label="Impervious" />
              <ColorMapEntry color="#289BE8" quantity="9" label="Wetland" />
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>

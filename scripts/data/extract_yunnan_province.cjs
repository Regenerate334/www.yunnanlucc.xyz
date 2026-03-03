const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../public/data/yunnan_boundary.geo.json');
const outputFile = path.join(__dirname, '../public/data/yunnan_province_only.geojson');

fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    try {
        const geojson = JSON.parse(data);
        const yunnanFeature = geojson.features.find(f =>
            f.properties.name === '云南' || f.properties.name === '云南省'
        );

        if (!yunnanFeature) {
            console.error('Yunnan feature not found in input file');
            return;
        }

        const newGeojson = {
            type: 'FeatureCollection',
            features: [yunnanFeature]
        };

        fs.writeFile(outputFile, JSON.stringify(newGeojson), (err) => {
            if (err) {
                console.error('Error writing file:', err);
            } else {
                console.log('Successfully created', outputFile);
            }
        });

    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
    }
});

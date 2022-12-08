import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Map from 'ol/Map';
import Stamen from 'ol/source/Stamen';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View';
import {Circle,Fill, Stroke, Style} from 'ol/style';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {getVectorContext} from 'ol/render';
import {getWidth} from 'ol/extent';
import Overlay from 'ol/Overlay';
import {Polygon} from 'ol/geom';
import Draw from 'ol/interaction/Draw';
import {getArea, getLength} from 'ol/sphere';
import {unByKey} from 'ol/Observable';

/**
 * Code for Line/Area Measurement used for measuring distances of each flight path
 */
let sketch;
let helpTooltipElement;
let helpTooltip;
let measureTooltipElement;
let measureTooltip;
let draw;
const continuePolygonMsg = 'Click to continue drawing the polygon';
const continueLineMsg = 'Click to continue drawing the line';

const pointerMoveHandler = function (evt) {
  if (evt.dragging) {
    return;
  }
  let helpMsg = 'Click to start drawing';

  if (sketch) {
    const geom = sketch.getGeometry();
    if (geom instanceof Polygon) {
      helpMsg = continuePolygonMsg;
    } else if (geom instanceof LineString) {
      helpMsg = continueLineMsg;
    }
  }

  helpTooltipElement.innerHTML = helpMsg;
  helpTooltip.setPosition(evt.coordinate);

  helpTooltipElement.classList.remove('hidden');
};

const tileLayer = new TileLayer({
  source: new Stamen({
    layer: 'toner',
  }),
});

const source = new VectorSource();
const vector = new VectorLayer({
  source: source,
  style: {
    'fill-color': 'rgba(255, 255, 255, 0.2)',
    'stroke-color': '#ffcc33',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#ffcc33',
  },
});

const map = new Map({
  layers: [tileLayer, vector],
  target: 'map',
  view: new View({
    center: [-11000000, 4600000],
    zoom: 2,
  }),
});

map.on('pointermove', pointerMoveHandler);

map.getViewport().addEventListener('mouseout', function () {
  helpTooltipElement.classList.add('hidden');
});

const typeSelect = document.getElementById('type');
const formatLength = function (line) {
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + ' ' + 'km';
  } else {
    output = Math.round(length * 100) / 100 + ' ' + 'm';
  }
  return output;
};

const formatArea = function (polygon) {
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + ' ' + 'km<sup>2</sup>';
  } else {
    output = Math.round(area * 100) / 100 + ' ' + 'm<sup>2</sup>';
  }
  return output;
};

function addInteraction() {
  const type = typeSelect.value == 'area' ? 'Polygon' : 'LineString';
  draw = new Draw({
    source: source,
    type: type,
    style: new Style({
      fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)',
      }),
      stroke: new Stroke({
        color: 'rgba(0, 0, 0, 0.5)',
        lineDash: [10, 10],
        width: 2,
      }),
      image: new Circle({
        radius: 5,
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 0.7)',
        }),
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.2)',
        }),
      }),
    }),
  });
  map.addInteraction(draw);

  createMeasureTooltip();
  createHelpTooltip();

  let listener;
  draw.on('drawstart', function (evt) {
    sketch = evt.feature;

    /** @type {import("../src/ol/coordinate.js").Coordinate|undefined} */
    let tooltipCoord = evt.coordinate;

    listener = sketch.getGeometry().on('change', function (evt) {
      const geom = evt.target;
      let output;
      if (geom instanceof Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
      } else if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    });
  });

  draw.on('drawend', function () {
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
    measureTooltip.setOffset([0, -7]);
    sketch = null;
    measureTooltipElement = null;
    createMeasureTooltip();
    unByKey(listener);
  });
}

function createHelpTooltip() {
  if (helpTooltipElement) {
    helpTooltipElement.parentNode.removeChild(helpTooltipElement);
  }
  helpTooltipElement = document.createElement('div');
  helpTooltipElement.className = 'ol-tooltip hidden';
  helpTooltip = new Overlay({
    element: helpTooltipElement,
    offset: [15, 0],
    positioning: 'center-left',
  });
  map.addOverlay(helpTooltip);
}

function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.parentNode.removeChild(measureTooltipElement);
  }
  measureTooltipElement = document.createElement('div');
  measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: 'bottom-center',
    stopEvent: false,
    insertFirst: false,
  });
  map.addOverlay(measureTooltip);
}

typeSelect.onchange = function () {
  map.removeInteraction(draw);
  addInteraction();
};

addInteraction();


/**
 * End of measurement Code
 */


/**
 * Code for drawing flight path lines
 */
const style = new Style({
  stroke: new Stroke({
    color: '#FF0000',
    width: 2,
  }),
});

const url = 'data/flights.json';
//Unable to use API at the moment, thus static flight path coordinate data is used and extracted from a json file

var buttonClicked = false;  //Starts the animation

window.addEventListener('load',function(){
  console.log(buttonClicked);
  document.getElementById('start').addEventListener('click',function(){
    buttonClicked = true;
  });
});

const flightsSource = new VectorSource({
  loader: function () {
    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (json) {
        const flightsData = json.flights;
        for (let i = 0; i < flightsData.length; i++) {
          const flight = flightsData[i];
          const origin = flight[0];
          const destination = flight[1];
          const arcGenerator = new arc.GreatCircle( //Initializes the path between the 2 coordinates
            {x: origin[1], 
             y: origin[0]},
            {x: destination[1], 
             y: destination[0]}
          );

          const arcLine = arcGenerator.Arc(100, {offset: 10});
          const features = [];
          arcLine.geometries.forEach(function (geometry) {
            const line = new LineString(geometry.coords);
            line.transform('EPSG:4326', 'EPSG:3857');

            features.push(
              new Feature({
                geometry: line,
                finished: false,
              })
            );
          });
          addLater(features, i * 50); 
        }
          
          tileLayer.on('postrender', animateFlights);
        
      });
  },
});

const flightsLayer = new VectorLayer({
  source: flightsSource,
  style: function (feature) {
    if (feature.get('finished')) {
      return style;
    } else {
      return null;
    }
  },
});

map.addLayer(flightsLayer);

const pointsPerMs = 0.02;
function animateFlights(event) {//The line is gradually going towards the destination from the origin
  if(buttonClicked){
    const vectorContext = getVectorContext(event);
    const frameState = event.frameState;
    vectorContext.setStyle(style);
    const features = flightsSource.getFeatures();
    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        if (!feature.get('finished')) {
          const coords = feature.getGeometry().getCoordinates();
          const elapsedTime = frameState.time - feature.get('start');
          if (elapsedTime >= 0) {
            const elapsedPoints = elapsedTime * pointsPerMs;
    
            if (elapsedPoints >= coords.length) {
              feature.set('finished', true);
            }
    
            const maxIndex = Math.min(elapsedPoints, coords.length);
            const currentLine = new LineString(coords.slice(0, maxIndex));
            const worldWidth = getWidth(map.getView().getProjection().getExtent());
            const offset = Math.floor(map.getView().getCenter()[0] / worldWidth);
            currentLine.translate(offset * worldWidth, 0);
            vectorContext.drawGeometry(currentLine);
            currentLine.translate(worldWidth, 0);
            vectorContext.drawGeometry(currentLine);
          }
        } 
    }
    map.render();
  }
  
}

function addLater(features, timeout) {
  window.setTimeout(function () {
    if(buttonClicked){
      let start = Date.now();
      features.forEach(function (feature) {
        feature.set('start', start);
        flightsSource.addFeature(feature);
        const duration =
          (feature.getGeometry().getCoordinates().length - 1) / pointsPerMs;
        start += duration;
      });
      }
    },timeout); 
}
/**
 * End of flight path code
 */

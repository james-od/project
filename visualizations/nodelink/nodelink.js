var _this = this;
var COLOR_DEFAULT_LINK = '#999999';
var COLOR_DEFAULT_NODE = '#333333';
var COLOR_HIGHLIGHT = '#ff8800';
var LINK_OPACITY = .5;
var LINK_WIDTH = 1;
var OFFSET_LABEL = { x: 5, y: 4 };
var LINK_GAP = 2;
var LAYOUT_TIMEOUT = 3000;
var LABELBACKGROUND_OPACITY = 1;
var LABELDISTANCE = 10;
var SLIDER_WIDTH = 100;
var SLIDER_HEIGHT = 35;
var NODE_SIZE = 1;
var width = window.innerWidth;
var height = window.innerHeight - 100;
var margin = { left: 20, top: 20 };
var TIMELINE_HEIGHT = 50;
var currentLayout = 'forceDirected';
var positions = new Object();
positions['forceDirected'] = [];
var dgraph = networkcube.getDynamicGraph();
var times = dgraph.times().toArray();
var time_start = times[0];
var time_end = times[times.length - 1];
var nodes = dgraph.nodes().toArray();
var volatilityMeasureEnabled = false;
var redundancyMeasureEnabled = false;
var activationMeasureEnabled = false;
var centralityMeasureEnabled = false;

var nodesOrderedByDegree = dgraph.nodes().toArray().sort(function (n1, n2) { return n2.neighbors().length - n1.neighbors().length; });
var nodePairs = dgraph.nodePairs();
var links = dgraph.links().toArray();

numberOfLinksAtEachTimeJump = [];
timesForLinks = dgraph.timeArrays.label;
for(i=0; i < dgraph.timeArrays.links.length; i++){
    numberOfLinksAtEachTimeJump.push(dgraph.timeArrays.links[i].length);
}

nodeSetLengthAtEachPoint = [];
for(i=0; i<dgraph.timeArrays.links.length; i++){
    let nodesAtThisPoint = new Set();
    for(j=0; j<dgraph.timeArrays.links[i].length; j++){
        nodesAtThisPoint.add( dgraph.linkArrays.source[dgraph.timeArrays.links[i][j]] )
        nodesAtThisPoint.add( dgraph.linkArrays.target[dgraph.timeArrays.links[i][j]] )
    }
    nodeSetLengthAtEachPoint.push(nodesAtThisPoint.size)
    //this could be useful later to get the connected nodes a each time point

    //Dont think this works because it only shows when new nodes are added, not when they're removedi
}


// Build a datastructure mapping nodes to each nodepair at each timestep
console.log("Preloaded volatility data structure")
nodesToActiveNodePairs = {};
console.log(dgraph)


//Get all nodes
for(i=0; i<dgraph.nodeArrays.length; i++){
  nodesToActiveNodePairs[i] = new Array(time_end._id).fill( null );
}
console.log("nodesToActiveNodePairs")
console.log(nodesToActiveNodePairs)

// Map every nodepair to nodes
nodePairToNodes = {};
for(i=0; i<dgraph.nodePairArrays.id.length; i++){
  nodePairToNodes[i] = [];
}
for(i=0; i<dgraph.nodePairArrays.source.length; i++){
  nodePairToNodes[i].push(dgraph.nodePairArrays.source[i])
  nodePairToNodes[i].push(dgraph.nodePairArrays.target[i])
}
console.log("nodePairToNodes")
console.log(nodePairToNodes)

//Map every link to nodepair
//getNodePairFromLink

//time -> NodePairs
timeToNodePairs = {};
for(time=0; time<dgraph.timeArrays.links.length; time++){
  timeToNodePairs[time] = new Set([])
  for(j=0; j<dgraph.timeArrays.links[time].length; j++){
    timeToNodePairs[time].add(getNodePairFromLink(dgraph, dgraph.timeArrays.links[time][j]))
  }
}
console.log("timeToNodePairs")
console.log(timeToNodePairs)

//Fill in the values into nodesToActiveNodePairs
for(var time in timeToNodePairs){
  for (var it = timeToNodePairs[time].values(), nodePair= null; nodePair=it.next().value; ) {
    node1 = nodePairToNodes[nodePair][0]
    node2 = nodePairToNodes[nodePair][1]
    if(nodesToActiveNodePairs[node1][time]){
      nodesToActiveNodePairs[node1][time].push(nodePair)
    }else{
      nodesToActiveNodePairs[node1][time] = [nodePair]
    }

    if(nodesToActiveNodePairs[node2][time]){
      nodesToActiveNodePairs[node2][time].push(nodePair)
    }else{
      nodesToActiveNodePairs[node2][time] = [nodePair]
    }
  }
}
console.log("nodesToActiveNodePairs")
console.log(nodesToActiveNodePairs)



Array.prototype.stanDeviate = function(){
   var i,j,total = 0, mean = 0, diffSqredArr = [];
   for(i=0;i<this.length;i+=1){
       total+=this[i];
   }
   mean = total/this.length;
   for(j=0;j<this.length;j+=1){
       diffSqredArr.push(Math.pow((this[j]-mean),2));
   }
   return (Math.sqrt(diffSqredArr.reduce(function(firstEl, nextEl){
            return firstEl + nextEl;
          })/this.length));
};

var nodeLength = nodes.length;
var hiddenLabels = [];
var LABELING_STRATEGY = 1;
var linkWeightScale = d3.scale.linear().range([0, LINK_WIDTH]);
linkWeightScale.domain([
    0,
    dgraph.links().weights().max()
]);
networkcube.setDefaultEventListener(updateEvent);
var menuDiv = d3.select('#menuDiv');
networkcube.makeSlider(menuDiv, 'Link Opacity', SLIDER_WIDTH, SLIDER_HEIGHT, LINK_OPACITY, 0, 1, function (value) {
    LINK_OPACITY = value;
    updateLinks();
});
networkcube.makeSlider(menuDiv, 'Node Size', SLIDER_WIDTH, SLIDER_HEIGHT, NODE_SIZE, .01, 3, function (value) {
    NODE_SIZE = value;
    updateNodeSize();
});
networkcube.makeSlider(menuDiv, 'Edge Gap', SLIDER_WIDTH, SLIDER_HEIGHT, LINK_GAP, 0, 10, function (value) {
    LINK_GAP = value;
    updateLayout();
});
networkcube.makeSlider(menuDiv, 'Link Width', SLIDER_WIDTH, SLIDER_HEIGHT, LINK_WIDTH, 0, 10, function (value) {
    LINK_WIDTH = value;
    linkWeightScale.range([0, LINK_WIDTH]);
    updateLinks();
});
makeDropdown(menuDiv, 'Labeling', ['Automatic', 'Hide All', 'Show All', 'Neighbors'], function (selection) {
    LABELING_STRATEGY = parseInt(selection);
    updateLabelVisibility();
});
function makeDropdown(d3parent, name, values, callback) {
    var s = d3parent.append('select')
        .attr('id', "selection-input_" + name);
    s.append('option')
        .html('Chose ' + name + ':');
    values.forEach(function (v, i) {
        s.append('option').attr('value', i).html(v);
    });
    s.on('change', function () {
        var e = document.getElementById("selection-input_" + name);
        callback(e.options[e.selectedIndex].value);
    });
}
var timeSvg = d3.select('#timelineDiv')
    .append('svg')
    .attr('width', width)
    .attr('height', TIMELINE_HEIGHT)
    .attr("transform", "translate(" + 55 + ",0)");
if (dgraph.times().size() > 1) {
    var timeSlider = new TimeSlider(dgraph, width - 90);
    timeSlider.appendTo(timeSvg);
    networkcube.addEventListener('timeRange', timeChangedHandler, false);
    networkcube.addEventListener('measureChange', measureChangedHandler);
}

$('#visDiv').append('<svg id="visSvg" width="' + (width - 20) + '" height="' + (height - 20) + '"></svg>');
var mouseStart;
var panOffsetLocal = [0, 0];
var panOffsetGlobal = [0, 0];
var isMouseDown = false;
var globalZoom = 1;
var svg = d3.select('#visSvg')
    .on('mousedown', function () {
    isMouseDown = true;
    mouseStart = [d3.event.x, d3.event.y];
})
    .on('mousemove', function () {
    if (isMouseDown) {
        panOffsetLocal[0] = (d3.event.x - mouseStart[0]) * globalZoom;
        panOffsetLocal[1] = (d3.event.y - mouseStart[1]) * globalZoom;
        svg.attr("transform", "translate(" + (panOffsetGlobal[0] + panOffsetLocal[0]) + ',' + (panOffsetGlobal[1] + panOffsetLocal[1]) + ")");
    }
})
    .on('mouseup', function () {
    isMouseDown = false;
    panOffsetGlobal[0] += panOffsetLocal[0];
    panOffsetGlobal[1] += panOffsetLocal[1];
})
    .on('wheel', function () {
    d3.event.preventDefault();
    d3.event.stopPropagation();
    var globalZoom = 1 + d3.event.wheelDelta / 1000;
    var mouse = [d3.event.x - panOffsetGlobal[0], d3.event.y - panOffsetGlobal[1]];
    var d, n;
    for (var i = 0; i < nodes.length; i++) {
        n = nodes[i];
        n.x = mouse[0] + (n.x - mouse[0]) * globalZoom;
        n.y = mouse[1] + (n.y - mouse[1]) * globalZoom;
    }
    updateLayout();
});
svg = svg.append('g')
    .attr('width', width)
    .attr('height', height);
var linkLayer = svg.append('g');
var nodeLayer = svg.append('g');
var labelLayer = svg.append('g');
var visualNodes;
var backingNodes;
var nodeLabels;
var nodeLabelOutlines;
var visualLinks;
var layout;
var lineFunction = d3.svg.line()
    .x(function (d) { return d.x; })
    .y(function (d) { return d.y; })
    .interpolate("linear");
for (var i = 0; i < nodes.length; i++) {
    nodes[i]['width'] = getNodeRadius(nodes[i]) * 2;
    nodes[i]['height'] = getNodeRadius(nodes[i]) * 2;
}
layout = d3.layout.force()
    .linkDistance(30)
    .size([width, height])
    .nodes(nodes)
    .links(links)
    .on('end', function () {
    unshowMessage();
    _this.updateNodes();
    _this.updateLinks();
    _this.updateLayout();
    var coords = [];
    for (var i = 0; i < nodes.length; i++) {
        coords.push({ x: nodes[i].x, y: nodes[i].y });
    }
    networkcube.sendMessage('layout', { coords: coords });
})
    .start();
showMessage('Calculating<br/>layout');
init();


/*
This creates paths of stars based on the number of points the star should have
e.g a four point star would look like:

var fourPointStar = [
  {angle: 0, r1: 2},
  {angle: Math.PI * 0.25, r1: 1},
  {angle: Math.PI * 0.5, r1: 2},
  {angle: Math.PI * 0.75, r1: 1},
  {angle: Math.PI, r1: 2},
  {angle: Math.PI * 1.25, r1: 1},
  {angle: Math.PI * 1.5, r1: 2},
  {angle: Math.PI * 1.75, r1: 1},
  {angle: Math.PI * 2, r1: 2}
];

And a five point star would look like:

var fivePointStar = [
  {angle: 0, r1: 2},
  {angle: Math.PI * 0.2, r1: 1},
  {angle: Math.PI * 0.4, r1: 2},
  {angle: Math.PI * 0.6, r1: 1},
  {angle: Math.PI * 0.8, r1: 2},
  {angle: Math.PI, r1: 1},
  {angle: Math.PI * 1.2, r1: 2},
  {angle: Math.PI * 1.4, r1: 1},
  {angle: Math.PI * 1.6, r1: 2},
  {angle: Math.PI * 1.8, r1: 1},
  {angle: Math.PI * 2, r1: 2}
];
*/
function generateStar(degree){

  if(degree <= 2){
    return []
  }

  increment = 1/degree
  points = []
  i = 0
  distance = 2
  while(i<2){
    points.push(
      {angle: Math.PI * i, r1: distance}
    )
    i += increment
    if(distance == 2){
      distance = 0.8
    }
    else{
      distance = 2
    }
  }

  console.log("MADE STAR:")
  console.log(points)
  return points
}

function getPathDataForVolatility(scale, node){

  console.log("NODE")
  console.log(node)
  volatility = getNodeVolatility(node)
  console.log(volatility)

  scale = node.width / 2.5
  var radialAreaGenerator = d3.svg.area.radial()
    .angle(function(d) {
      return d.angle;
    })
    .outerRadius(function(d) {
      return d.r1 * scale;
    });

  var pathData = radialAreaGenerator(generateStar( Math.round(volatility*2) ));
  return pathData

}
function init() {

    var _this = this;
    visualNodes = nodeLayer.selectAll('nodes')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', function (n) { return getNodeRadius(n); })
        .attr('class', 'nodes')
        .style('fill', "#ff8800")
        .on('mouseover', mouseOverNode)
        .on('mouseout', mouseOutNode)
        .on('click', function (d) {
        var selections = d.getSelections();
        var currentSelection = _this.dgraph.getCurrentSelection();
        for (var j = 0; j < selections.length; j++) {
            if (selections[j] == currentSelection) {
                networkcube.selection('remove', { nodes: [d] });
                return;
            }
        }
        networkcube.selection('add', { nodes: [d] });
    })

    backingNodes = nodeLayer.selectAll('nodes')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', function (n) { return 0; })
        .attr('class', 'nodes')
        .style('fill', "black")
        .style('fill-opacity', 0.2)
        .on('mouseover', mouseOverNode)
        .on('mouseout', mouseOutNode)
        .on('click', function (d) {
        var selections = d.getSelections();
        var currentSelection = _this.dgraph.getCurrentSelection();
        for (var j = 0; j < selections.length; j++) {
            if (selections[j] == currentSelection) {
                networkcube.selection('remove', { nodes: [d] });
                return;
            }
        }
        networkcube.selection('add', { nodes: [d] });
    })

    // Create a path element and set its d attribute
    volatilitySpikes = nodeLayer.selectAll('nodes')
        .data(nodes)
        .enter()
        .append('path')
        // .attr('d', function(d) {
        //   return getPathDataForVolatility(0.5, d)
        // })
        // .style("fill", "black");

    nodeLabelOutlines = labelLayer.selectAll('.nodeLabelOutlines')
        .data(nodes)
        .enter()
        .append('text')
        .attr('z', 2)
        .text(function (d) { return d.label(); })
        .style('font-size', 12)
        .attr('visibility', 'hidden')
        .attr('class', 'nodeLabelOutlines');
    nodeLabels = labelLayer.selectAll('nodeLabels')
        .data(nodes)
        .enter()
        .append('text')
        .attr('z', 2)
        .text(function (d) { return d.label(); })
        .style('font-size', 12)
        .attr('visibility', 'hidden');
    calculateCurvedLinks();
    visualLinks = linkLayer.selectAll('visualLinks')
        .data(links)
        .enter()
        .append('path')
        .attr('d', function (d) { return lineFunction(d.path); })
        .style('opacity', LINK_OPACITY)
        .on('mouseover', function (d, i) {
        networkcube.highlight('set', { links: [d] });
    })
        .on('mouseout', function (d) {
        networkcube.highlight('reset');
    })
        .on('click', function (d) {
        var selections = d.getSelections();
        var currentSelection = _this.dgraph.getCurrentSelection();
        for (var j = 0; j < selections.length; j++) {
            if (selections[j] == currentSelection) {
                networkcube.selection('remove', { links: [d] });
                return;
            }
        }
        networkcube.selection('add', { links: [d] });
    });
    updateLinks();
    updateNodes();
    updateLayout();
}
function updateLayout() {
    backingNodes
        .attr('cx', function (d, i) { return d.x; })
        .attr('cy', function (d, i) { return d.y; });
    visualNodes
        .attr('cx', function (d, i) { return d.x; })
        .attr('cy', function (d, i) { return d.y; });
    volatilitySpikes
        .attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")"
        })
    nodeLabels
        .attr('x', function (d, i) { return d.x + OFFSET_LABEL.x; })
        .attr('y', function (d, i) { return d.y + OFFSET_LABEL.y; });
    nodeLabelOutlines
        .attr('x', function (d, i) { return d.x + OFFSET_LABEL.x; })
        .attr('y', function (d, i) { return d.y + OFFSET_LABEL.y; });
    calculateCurvedLinks();
    visualLinks
        .attr('d', function (d) { return lineFunction(d.path); });
    updateLabelVisibility();
}
function getLabelWidth(n) {
    return n.label().length * 8.5 + 10;
}
function getLabelHeight(n) {
    return 18;
}
function getNodeRadius(n) {
    return Math.sqrt(n.links().length) * NODE_SIZE + 1;
}

/*
Volatility is calculated for a given node and time range by creating a data
structure where each edge maps to a list of 0s or 1s representing each time
frame. If the edge was avtive during that time frame then the value would be a
1. So we would have the structure {482: [0,1,0], 484: [0,1,0], 487:[0,1,0] }
for node 189 if it had all of its potential edges active during t=1 and it's
potential edges were 482, 484 and 487.
We then take this structure and average the standard deviations of each. In this
case the resulting volatility would be std(0,1,0).
*/
function getSum(total, num) {
  return total + num;
}
function getNodePairFromLink(g, link){
  console.log("getNodePairFromLink")
  for(var i=0; i<g.nodePairArrays.links.length; i++){
    if(g.nodePairArrays.links[i].indexOf(link) > -1){
      return i
    }
  }
  return -1
}

function flatten(arr) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
  }, []);
}

function getMaxNodeRedundancy(n){
  ret = 1; // Don't want zero-sized circles
  console.log("Calculating Max Redundancy")
  previouslySeenNodePairs = nodesToActiveNodePairs[n._id].slice(0, 0)
  currentNodePairs = nodesToActiveNodePairs[n._id].slice(0, times.length)

  var mergedPrevious = flatten(previouslySeenNodePairs);
  var filteredPrevious = mergedPrevious.filter(function (el) {
    return el != null;
  });
  var mergedCurrent = flatten(currentNodePairs);
  var filteredCurrent = mergedCurrent.filter(function (el) {
    return el != null;
  });
  var previousSeenSet = new Set(filteredPrevious)
  var currentSet = new Set(filteredCurrent)
  for(val of previousSeenSet){
    if(currentSet.has(val)){
      ret += 1;
    }
  }
  console.log(previousSeenSet)
  console.log(currentSet)
  console.log("Max redundancy IS " + ret)
  return ret;
}

function getNodeRedundancy(n){
  ret = 1; // Don't want zero-sized circles
  console.log("Calculating Redundancy")
  previouslySeenNodePairs = nodesToActiveNodePairs[n._id].slice(0, time_start._id)
  currentNodePairs = nodesToActiveNodePairs[n._id].slice(time_start._id, time_end._id)

  var mergedPrevious = flatten(previouslySeenNodePairs);
  var filteredPrevious = mergedPrevious.filter(function (el) {
    return el != null;
  });
  var mergedCurrent = flatten(currentNodePairs);
  var filteredCurrent = mergedCurrent.filter(function (el) {
    return el != null;
  });
  var previousSeenSet = new Set(filteredPrevious)
  var currentSet = new Set(filteredCurrent)
  for(val of previousSeenSet){
    if(currentSet.has(val)){
      ret += 1;
    }
  }
  console.log(previousSeenSet)
  console.log(currentSet)
  console.log("Redundancy IS " + ret)
  return ret;
}

function getMaxNodeActivation(n){
  console.log("Calculating Max Activation")
  ret = 1; // Don't want zero-sized circles
  previouslySeenNodePairs = nodesToActiveNodePairs[n._id].slice(0, 0)
  currentNodePairs = nodesToActiveNodePairs[n._id].slice(0, time.length)

  var mergedPrevious = flatten(previouslySeenNodePairs);
  var filteredPrevious = mergedPrevious.filter(function (el) {
    return el != null;
  });
  var mergedCurrent = flatten(currentNodePairs);
  var filteredCurrent = mergedCurrent.filter(function (el) {
    return el != null;
  });
  var previousSeenSet = new Set(filteredPrevious)
  var currentSet = new Set(filteredCurrent)
  for(val of currentSet){
    if(!previousSeenSet.has(val)){
      ret += 1;
    }
  }
  console.log(previousSeenSet)
  console.log(currentSet)
  console.log("Max activation IS " + ret)
  return ret;
}

function getNodeActivation(n){
  console.log("Calculating Activation")
  ret = 1; // Don't want zero-sized circles
  console.log("Calculating Redundancy")
  previouslySeenNodePairs = nodesToActiveNodePairs[n._id].slice(0, time_start._id)
  currentNodePairs = nodesToActiveNodePairs[n._id].slice(time_start._id, time_end._id)

  var mergedPrevious = flatten(previouslySeenNodePairs);
  var filteredPrevious = mergedPrevious.filter(function (el) {
    return el != null;
  });
  var mergedCurrent = flatten(currentNodePairs);
  var filteredCurrent = mergedCurrent.filter(function (el) {
    return el != null;
  });
  var previousSeenSet = new Set(filteredPrevious)
  var currentSet = new Set(filteredCurrent)
  for(val of currentSet){
    if(!previousSeenSet.has(val)){
      ret += 1;
    }
  }
  console.log(previousSeenSet)
  console.log(currentSet)
  console.log("Redundancy IS " + ret)
  return ret;
}



function getNodeVolatility(n) {

    console.log("Calculating volatility")

    sliceNodesToActiveNodePairs = nodesToActiveNodePairs[n._id].slice(time_start._id, time_end._id);
    //console.log(sliceNodesToActiveNodePairs);

    nodePairsToNumberOfTimesTheyOccurred = {}

    for(time=0; time<sliceNodesToActiveNodePairs.length; time++){
      if(sliceNodesToActiveNodePairs[time]){
        for(i=0; i<sliceNodesToActiveNodePairs[time].length; i++){
          nodePair = sliceNodesToActiveNodePairs[time][i]
          if(nodePairsToNumberOfTimesTheyOccurred[nodePair]){
            nodePairsToNumberOfTimesTheyOccurred[nodePair] += 1
          }else{
            nodePairsToNumberOfTimesTheyOccurred[nodePair] = 1
          }
        }
      }
    }

    volatilitySum = 0;
    for(var nodePair in nodePairsToNumberOfTimesTheyOccurred){
      occurrences = nodePairsToNumberOfTimesTheyOccurred[nodePair]
      arrayChunk1 = new Array(occurrences).fill( 1 );
      arrayChunk2 = new Array(sliceNodesToActiveNodePairs.length-occurrences).fill( 0 );
      volatilitySum += arrayChunk1.concat(arrayChunk2).stanDeviate();
    }
    numberOfNodePairs = Object.keys(nodePairsToNumberOfTimesTheyOccurred).length;

    multiplier = 1;

    console.log("volSum " + volatilitySum)
    console.log("numberOfNodePairs " + numberOfNodePairs)
    if(numberOfNodePairs <= 0 || volatilitySum <= 0){
      return 1;
    }
    if((volatilitySum * multiplier) < 1){
        return 1
    }
    return volatilitySum * multiplier;
}

function getMaxNodeVolatility(n) {

    console.log("Calculating volatility")

    sliceNodesToActiveNodePairs = nodesToActiveNodePairs[n._id].slice(0, times.length);
    //console.log(sliceNodesToActiveNodePairs);

    nodePairsToNumberOfTimesTheyOccurred = {}

    for(time=0; time<sliceNodesToActiveNodePairs.length; time++){
      if(sliceNodesToActiveNodePairs[time]){
        for(i=0; i<sliceNodesToActiveNodePairs[time].length; i++){
          nodePair = sliceNodesToActiveNodePairs[time][i]
          if(nodePairsToNumberOfTimesTheyOccurred[nodePair]){
            nodePairsToNumberOfTimesTheyOccurred[nodePair] += 1
          }else{
            nodePairsToNumberOfTimesTheyOccurred[nodePair] = 1
          }
        }
      }
    }

    volatilitySum = 0;
    for(var nodePair in nodePairsToNumberOfTimesTheyOccurred){
      occurrences = nodePairsToNumberOfTimesTheyOccurred[nodePair]
      arrayChunk1 = new Array(occurrences).fill( 1 );
      arrayChunk2 = new Array(sliceNodesToActiveNodePairs.length-occurrences).fill( 0 );
      volatilitySum += arrayChunk1.concat(arrayChunk2).stanDeviate();
    }
    numberOfNodePairs = Object.keys(nodePairsToNumberOfTimesTheyOccurred).length;

    multiplier = 1;

    console.log("volSum " + volatilitySum)
    console.log("numberOfNodePairs " + numberOfNodePairs)
    if(numberOfNodePairs <= 0 || volatilitySum <= 0){
      return 1;
    }
    if((volatilitySum * multiplier) < 1){
        return 1
    }
    return volatilitySum * multiplier;
}
function updateLabelVisibility() {
    hiddenLabels = [];
    if (LABELING_STRATEGY == 0) {
        var n1, n2;
        for (var i = 0; i < nodesOrderedByDegree.length; i++) {
            n1 = nodesOrderedByDegree[i];
            if (hiddenLabels.indexOf(n1) > -1)
                continue;
            for (var j = i + 1; j < nodesOrderedByDegree.length; j++) {
                n2 = nodesOrderedByDegree[j];
                if (hiddenLabels.indexOf(n2) > -1)
                    continue;
                if (areNodeLabelsOverlapping(n1, n2)) {
                    hiddenLabels.push(n2);
                }
                else if (isHidingNode(n1, n2)) {
                    hiddenLabels.push(n1);
                    break
                }
            }
        }
    }
    else if (LABELING_STRATEGY == 1) {
        hiddenLabels = nodes.slice(0);
    }
    else if (LABELING_STRATEGY == 2) {
        hiddenLabels = [];
    }
    else if (LABELING_STRATEGY == 3) {
        hiddenLabels = nodes.slice(0);
    }
    nodeLabels.attr('visibility', function (n) { return hiddenLabels.indexOf(n) > -1 ? 'hidden' : 'visible'; });
    nodeLabelOutlines.attr('visibility', function (n) { return hiddenLabels.indexOf(n) > -1 ? 'hidden' : 'visible'; });
}
function areNodeLabelsOverlapping(n1, n2) {
    var n1e = n1.x + getLabelWidth(n1) / 2 + LABELDISTANCE;
    var n2e = n2.x + getLabelWidth(n2) / 2 + LABELDISTANCE;
    var n1w = n1.x - getLabelWidth(n1) / 2 - LABELDISTANCE;
    var n2w = n2.x - getLabelWidth(n2) / 2 - LABELDISTANCE;
    var n1n = n1.y + getLabelHeight(n1) / 2 + LABELDISTANCE;
    var n2n = n2.y + getLabelHeight(n2) / 2 + LABELDISTANCE;
    var n1s = n1.y - getLabelHeight(n1) / 2 - LABELDISTANCE;
    var n2s = n2.y - getLabelHeight(n2) / 2 - LABELDISTANCE;
    return (n1e > n2w && n1w < n2e && n1s < n2n && n1n > n2s)
        || (n1e > n2w && n1w < n2e && n1n > n2s && n1s < n2n)
        || (n1w < n2e && n1s > n2n && n1s < n2n && n1n > n2s)
        || (n1w < n2e && n1n < n2s && n1n > n2s && n1s < n2n);
}
function isHidingNode(n1, n2) {
    var n1e = n1.x + getLabelWidth(n1) / 2 + LABELDISTANCE;
    var n1w = n1.x - getLabelWidth(n1) / 2 - LABELDISTANCE;
    var n1n = n1.y + getLabelHeight(n1) / 2 + LABELDISTANCE;
    var n1s = n1.y - getLabelHeight(n1) / 2 - LABELDISTANCE;
    return n1w < n2.x && n1e > n2.x && n1n < n2.y && n1s > n2.y;
}

var div = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

function everyIndexOf(item, list){
  var a=[],i=-1;
  while((i=list.indexOf(item,i+1)) >= 0) a.push(i);
  return a;
}

function getLinksFromNode(n){
  sources = everyIndexOf(n._id, n.g.linkArrays.source)
  targets = everyIndexOf(n._id, n.g.linkArrays.target)
  return sources.concat(targets)
}


function getMaxNumberOfNodeEdges(n){
  //time_start
  //time_end
  allLinks = getLinksFromNode(n)
  numberOfLinksInTimeFrame = 1
  for(i=0; i<times.length; i++){
    for(j=0;j<allLinks.length;j++){
      if(n.g.timeArrays.links[i].indexOf(allLinks[j]) > -1){
        numberOfLinksInTimeFrame += 1
      }
    }
  }

  return numberOfLinksInTimeFrame
}

function getNumberOfNodeEdges(n){
  //time_start
  //time_end
  allLinks = getLinksFromNode(n)
  numberOfLinksInTimeFrame = 1
  for(i=time_start._id; i<time_end._id; i++){
    for(j=0;j<allLinks.length;j++){
      if(n.g.timeArrays.links[i].indexOf(allLinks[j]) > -1){
        numberOfLinksInTimeFrame += 1
      }
    }
  }

  return numberOfLinksInTimeFrame
}

function mouseOverNode(n) {
    numberOfEdges = getNumberOfNodeEdges(n)
    measureLabel = ""
    measureValue = 0
    fullTimePeriodValue = 0
    if(activationMeasureEnabled){
        measureLabel = "Activation"
        measureValue = Math.round(getNodeActivation(n) * 100)/100
        fullTimePeriodValue = Math.round(getMaxNodeActivation(n) *100)/100
    }
    if(redundancyMeasureEnabled){
        measureLabel = "Redundancy"
        measureValue = Math.round(getNodeRedundancy(n) * 100)/100
        fullTimePeriodValue = Math.round(getMaxNodeRedundancy(n) *100)/100
    }
    if(volatilityMeasureEnabled){
        measureLabel = "Volatility"
        measureValue = Math.round(getNodeVolatility(n) * 100)/100
        fullTimePeriodValue = Math.round(getMaxNodeVolatility(n) * 100)/100
    }
    if(centralityMeasureEnabled){
        measureLabel = "Degree Centrality"
        measureValue = Math.round(getNumberOfNodeEdges(n) * 100)/100
        fullTimePeriodValue = Math.round(getMaxNumberOfNodeEdges(n) * 100)/100
    }
    networkcube.highlight('set', { nodes: [n] });
        div.transition()
            .duration(200)
            .style("opacity", .9);
        div .html(measureLabel + "<br/><br/>Selected Period: " + (measureValue-1) + "<br/>Full period: "+(fullTimePeriodValue-1))
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 40) + "px");
}
function mouseOutNode(n) {
    networkcube.highlight('reset');
    div.transition()
        .duration(500)
        .style("opacity", 0);
}

function measureChangedHandler(m) {
    console.log("Measure changed handler yay")
    console.log(m)
    activationMeasureEnabled = false;
    redundancyMeasureEnabled = false;
    volatilityMeasureEnabled = false;
    centralityMeasureEnabled = false;
    if(m.measure == 'Activation'){
        activationMeasureEnabled = true;
    }

    if(m.measure == 'Redundancy'){
        redundancyMeasureEnabled = true
    }

    if(m.measure == 'Volatility'){
        volatilityMeasureEnabled = true
    }

    if(m.measure == 'Centrality'){
        centralityMeasureEnabled = true
    }
    updateLinks();
    updateNodes();
}

function timeChangedHandler(m) {
    console.log("Time changed - nodelink")
    time_start = times[0];
    time_end = times[times.length - 1];
    for (var i = 0; i < times.length; i++) {
        if (times[i].unixTime() > m.startUnix) {
            time_start = times[i - 1];
            break;
        }
    }
    for (i; i < times.length; i++) {
        if (times[i].unixTime() > m.endUnix) {
            time_end = times[i - 1];
            break;
        }
    }
    timeSlider.set(m.startUnix, m.endUnix);
    updateLinks();
    updateNodes();
}
function updateEvent(m) {
    updateLinks();
    updateNodes();
}
function updateNodeSize() {
    visualNodes
        .attr('r', function (n) { return getNodeRadius(n); });
}
function updateNodes() {
 // if(volatilityMeasureEnabled){
 //   volatilitySpikes
 //       .attr('d', function(d) {
 //         return getPathDataForVolatility(0.5, d)
 //       })
 //       .style("fill", "#333333")
 //       .style("visibility", "visible");
 // }else{
 //   volatilitySpikes
 //       .style("visibility", "hidden");
 // }
  if(volatilityMeasureEnabled){
    visualNodes.attr('r', function (n) { return (2* Math.log( getNodeVolatility(n))) + 1});
    backingNodes.attr('r', function (n) { return (2* Math.log(getMaxNodeVolatility(n))) + 1; });
  }
  if(redundancyMeasureEnabled){
    visualNodes.attr('r', function (n) { return (2 * Math.log(getNodeRedundancy(n))) + 1; });
    backingNodes.attr('r', function (n) { return (2 * Math.log(getMaxNodeRedundancy(n))) + 1; });
  }
  if(activationMeasureEnabled){
    visualNodes.attr('r', function (n) { return (2 * Math.log(getNodeActivation(n))) + 1; });
    backingNodes.attr('r', function (n) { return (2 * Math.log(getMaxNodeActivation(n))) + 1; });
  }
  if(centralityMeasureEnabled){
      visualNodes.attr('r', function (n) { return (2 * Math.log(getNumberOfNodeEdges(n))) + 1; });
      backingNodes.attr('r', function (n) { return (2 * Math.log(getMaxNumberOfNodeEdges(n))) + 1; });
  }

    visualNodes
        .style('fill', function (d) {
        var color;
        if (!color){
            color = "#333333";
        }
        return color;
    })
        .style('opacity', function (d) {
        var visible = d.isVisible();
        if (!visible)
            return 0;
        else
            return 1;
    });
    nodeLabels
        .attr('visibility', function (e) { return e.isHighlighted()
        || e.links().highlighted().length > 0
        || hiddenLabels.indexOf(e) == -1
        || (LABELING_STRATEGY == 3 && e.neighbors().highlighted().length > 0)
        ? 'visible' : 'hidden'; })
        .style('color', function (d) {
        var color;
        if (d.isHighlighted()) {
            color = COLOR_HIGHLIGHT;
        }
        else {
            color = networkcube.getPriorityColor(d);
        }
        if (!color)
            color = "#ff8800";
        return color;
    });
    nodeLabelOutlines
        .attr('visibility', function (e) { return e.isHighlighted()
        || e.links().highlighted().length > 0
        || hiddenLabels.indexOf(e) == -1
        || (LABELING_STRATEGY == 3 && e.neighbors().highlighted().length > 0)
        ? 'visible' : 'hidden'; });

}

function updateLinks() {
    inEachTimeRange = {}
    console.log("updating links3")
    visualLinks.style('stroke', function (d) {
        var color = networkcube.getPriorityColor(d);
        if (!color)
            color = COLOR_DEFAULT_LINK;
        return color;
    })
        .style('opacity', function (d) {
        var visible = d.isVisible();
        if (!visible
            || !d.source.isVisible()
            || !d.target.isVisible())
            return 0;
        i = 0
        // while(i < times.length - 1){
        //   //console.log("in times range " + i +" " + (i+1))
        //   console.log("yo")
        //   // if(d.presentIn(times[i], times[i+1])){
        //   //   if(inEachTimeRange[i]){
        //   //     inEachTimeRange[i].push(d)
        //   //   }else{
        //   //     inEachTimeRange[i] = [d]
        //   //   }
        //   // }
        //   i+=1
        // }
        if (d.presentIn(time_start, time_end)) {
            return d.isHighlighted() || d.source.isHighlighted() || d.target.isHighlighted() ?
                Math.min(1, LINK_OPACITY + .2) : LINK_OPACITY;
        }
        else {
            return 0;
        }
    })
        .style('stroke-width', function (d) {
        var w = linkWeightScale(d.weights(time_start, time_end).mean());
        return d.isHighlighted() ? w * 2 : w;
    });
    console.log(inEachTimeRange)
}
function calculateCurvedLinks() {
    var path, dir, offset, offset2, multiLink;
    var links;
    for (var i = 0; i < dgraph.nodePairs().length; i++) {
        multiLink = dgraph.nodePair(i);
        if (multiLink.links().length < 2) {
            multiLink.links().toArray()[0]['path'] = [
                { x: multiLink.source.x, y: multiLink.source.y },
                { x: multiLink.source.x, y: multiLink.source.y },
                { x: multiLink.target.x, y: multiLink.target.y },
                { x: multiLink.target.x, y: multiLink.target.y }
            ];
        }
        else {
            links = multiLink.links().toArray();
            if (multiLink.source == multiLink.target) {
                var minGap = getNodeRadius(multiLink.source) / 2 + 4;
                for (var j = 0; j < links.length; j++) {
                    links[j]['path'] = [
                        { x: multiLink.source.x, y: multiLink.source.y },
                        { x: multiLink.source.x, y: multiLink.source.y - minGap - (i * LINK_GAP) },
                        { x: multiLink.source.x + minGap + (i * LINK_GAP), y: multiLink.source.y - minGap - (i * LINK_GAP) },
                        { x: multiLink.source.x + minGap + (i * LINK_GAP), y: multiLink.source.y },
                        { x: multiLink.source.x, y: -multiLink.source.y },
                    ];
                }
            }
            else {
                dir = {
                    x: multiLink.target.x - multiLink.source.x,
                    y: multiLink.target.y - multiLink.source.y
                };
                offset = stretchVector([-dir.y, dir.x], LINK_GAP);
                offset2 = stretchVector([dir.x, dir.y], LINK_GAP);
                for (var j = 0; j < links.length; j++) {
                    links[j]['path'] = [
                        { x: multiLink.source.x, y: multiLink.source.y },
                        { x: multiLink.source.x + offset2[0] + (j - links.length / 2 + .5) * offset[0],
                            y: (multiLink.source.y + offset2[1] + (j - links.length / 2 + .5) * offset[1]) },
                        { x: multiLink.target.x - offset2[0] + (j - links.length / 2 + .5) * offset[0],
                            y: (multiLink.target.y - offset2[1] + (j - links.length / 2 + .5) * offset[1]) },
                        { x: multiLink.target.x, y: multiLink.target.y }
                    ];
                }
            }
        }
    }
}
function stretchVector(vec, finalLength) {
    var len = 0;
    for (var i = 0; i < vec.length; i++) {
        len += Math.pow(vec[i], 2);
    }
    len = Math.sqrt(len);
    for (var i = 0; i < vec.length; i++) {
        vec[i] = vec[i] / len * finalLength;
    }
    return vec;
}

activeMeasures = []
window.onmessage = function(e){
    //alert(JSON.stringify(e.data))
    console.log("Received message")
    if(activeMeasures.indexOf(e.data.measure) > -1){
        activeMeasures.splice(activeMeasures.indexOf(e.data.measure), 1)
        if(e.data.measure = "Volatility"){
            volatilityMeasureEnabled = false;
            updateNodes();
        }
    }else{
        activeMeasures.push(e.data.measure)
    }
    console.log("Checking data bar presence")
    if(activeMeasures.indexOf("Data Bar") > -1){
        console.log("HIDE DATA BAR")
        hideDataBar()
    }else{
        console.log("DONT HIDE DATA BAR")
        showDataBar()
    }
    // if(activeMeasures.indexOf("Connected Nodes") > -1){
    //     showConnectedNodesGraph()
    // }
    // if(activeMeasures.indexOf("Edges") > -1){
    //     showEdgesGraph()
    // }
    // if(activeMeasures.indexOf("Density") > -1){
    //     showDensityGraph()
    // }
    if(activeMeasures.indexOf("Volatility") > -1){
        volatilityMeasureEnabled = true;
        updateNodes();
    }
    //alert(activeMeasures)
};

$(document).on("keypress", function (e) {
    console.log(e.which);
    if(e.which == 103){
        console.log(networkcube)
        showEdgesGraph()
    }
    if(e.which == 104){
      showConnectedNodesGraph()
    }
    if(e.which == 106){
      showDensityGraph()
    }
    if(e.which == 107){
      volatilityMeasureEnabled = true;
      updateNodes();
    }
    if(e.which == 99){
        clearCanvas()
        volatilityMeasureEnabled = false;
        updateNodes();
    }
});

function showEdgesGraph(){
    //clearCanvas()
    $('#visDiv').append('<div id=edgesGraph><text id=graphTitle>Edges Over time</text><canvas id=myCanvas></canvas></div>');
    var canvas = document.getElementById("myCanvas");
    var edgesGraph = document.getElementById("edgesGraph");
    var theContext = canvas.getContext("2d");
    theContext.canvas.width = $('#visDiv').width() * 0.95;
    var X = numberOfLinksAtEachTimeJump;
    var width = $('#visDiv').width() * 0.95;
    var height = 50;
    var offset = (1 / (X.length - 1)) * width;

    edgesGraph.style.top = "100px"
    edgesGraph.style.left = "15px"
    edgesGraph.style.position = "absolute"

    theContext.strokeRect(0, 0, width, height)

    theContext.beginPath();
    theContext.moveTo(0, 50 - (X[0]/2));
    for (var x = 1; x < X.length; x++) {
      theContext.lineTo(x * offset, 50 - (X[x]/2));
    }
    theContext.stroke();
}

console.log("Values used for Nodes Graph:")
console.log(nodeSetLengthAtEachPoint)
console.log("Values used for Edges Graph:")
console.log(JSON.stringify(numberOfLinksAtEachTimeJump))

lengthsOfMatrixRows = []

i = 0
while(i < dgraph.matrix.length){
  var filtered = dgraph.matrix[i].filter(function (el) {
      return el != null;
  });
  lengthsOfMatrixRows.push(filtered.length)
  i+=1
}
console.log(lengthsOfMatrixRows)

function showDataBar(){
  $('#databarFrame').show()
}

function hideDataBar(){
  $('#databarFrame').hide()
}


function showConnectedNodesGraph(){
    //clearCanvas()
    $('#visDiv').append('<div id=nodesGraph><text id=graphTitle>Connected Nodes Over time</text><canvas id=myCanvas></canvas></div>');
    var canvas = document.getElementById("myCanvas");
    var nodesGraph = document.getElementById("nodesGraph");
    var theContext = canvas.getContext("2d");
    theContext.canvas.width = $('#visDiv').width() * 0.95;
    var X = nodeSetLengthAtEachPoint;
    var width = $('#visDiv').width() * 0.95;
    var height = 50;
    var offset = (1 / (X.length - 1)) * width;

    nodesGraph.style.top = "100px"
    nodesGraph.style.left = "15px"
    nodesGraph.style.position = "absolute"

    theContext.strokeRect(0, 0, width, height)

    theContext.beginPath();
    theContext.moveTo(0, 50 - (X[0]/2));
    for (var x = 1; x < X.length; x++) {
      //console.log(timesForLinks[x])
      theContext.lineTo(x * offset, 50 - (X[x]/2));
    }
    theContext.stroke();
}

function calculateDensity(edges, nodes){
  ret = []
  i = 0
  while(i < edges.length){
    ret.push( (edges[i]) / (nodes[i] * (nodes[i] - 1)) )
    i += 1
  }
  return ret
}

function showDensityGraph(){
    console.log("show DG")
    //clearCanvas()
    $('#visDiv').append('<div id=densityGraph><text id=graphTitle>Density over time</text><canvas id=myCanvas></canvas></div>');
    var canvas = document.getElementById("myCanvas");
    var densityGraph = document.getElementById("densityGraph");
    var theContext = canvas.getContext("2d");
    theContext.canvas.width = $('#visDiv').width() * 0.95;
    var X = calculateDensity(numberOfLinksAtEachTimeJump, nodeSetLengthAtEachPoint);
    var width = $('#visDiv').width() * 0.95;
    var height = 50;
    var offset = (1 / (X.length - 1)) * width;

    densityGraph.style.top = "100px"
    densityGraph.style.left = "15px"
    densityGraph.style.position = "absolute"

    theContext.strokeRect(0, 0, width, height)

    theContext.beginPath();
    theContext.moveTo(0, 50 - (X[0]*25));
    for (var x = 1; x < X.length; x++) {
      theContext.lineTo(x * offset, 50 - (X[x]*25));
    }
    theContext.stroke();
}

function clearCanvas(){
  var title = document.getElementById("graphTitle");
  if(title){ while (title.firstChild) title.removeChild(title.firstChild);}
  var canvas = document.getElementById("myCanvas");
  if(canvas){
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function changeTime(){
  networkcube.timeRange(-128436529, 66957942857.14288, 1, true)
}

function showMessage(message) {
    if ($('#messageBox'))
        $('#messageBox').remove();
    $('#visDiv').append('<div id="messageBox"><p>' + message + '</p></div>');
}
function unshowMessage() {
    if ($('#messageBox'))
        $('#messageBox').remove();
}
console.log(dgraph)

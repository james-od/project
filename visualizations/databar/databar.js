console.log("Initialising databar")

var dgraph = networkcube.getDynamicGraph();
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
numberOfLinksAtEachTimeJump = [];
timesForLinks = dgraph.timeArrays.label;
for(i=0; i < dgraph.timeArrays.links.length; i++){
    numberOfLinksAtEachTimeJump.push(dgraph.timeArrays.links[i].length);
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

function drawGraph(graphName, X, topMargin, multiplier){
  $('#visDiv').append('<div id=' + graphName +'Graph><canvas id=' + graphName +'Canvas></canvas></div>');
  var canvas = document.getElementById(graphName + "Canvas");
  var graph = document.getElementById(graphName + "Graph");
  var theContext = canvas.getContext("2d")
  theContext.canvas.width = $('#visDiv').width() * 0.95;
  var width = $('#visDiv').width() * 0.95;
  var height = 50;
  var offset = (1 / (X.length - 1)) * width;

  graph.style.top = topMargin
  graph.style.left = "15px"
  graph.style.position = "absolute"

  theContext.strokeRect(0, 0, width, height)

  console.log("Going to plot: " + X)
  console.log(graph)
  theContext.beginPath();
  theContext.moveTo(0, 50 - (X[x]*multiplier));
  for (var x = 1; x < X.length; x++) {
    //console.log(timesForLinks[x])
    theContext.lineTo(x * offset, 50 - (X[x]*multiplier));
  }
  theContext.stroke();
}

window.onload = function(){
  x = nodeSetLengthAtEachPoint;
  drawGraph("connectedNodes", x, "0px", 0.5);
  x = calculateDensity(numberOfLinksAtEachTimeJump, nodeSetLengthAtEachPoint);
  drawGraph("density", x, "50px", 25)
  x = numberOfLinksAtEachTimeJump;
  drawGraph("edges", x, "100px", 0.5)
};

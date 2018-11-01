var RECT_SIZE = 13;
var INTENT = 0;
var LINE_HEIGHT = 13;
var GAP_ICONS = 3;
var OPACITY_ICONS = .2;
var width = window.innerWidth;
console.log('load vis');
var dgraph = networkcube.getDynamicGraph();
networkcube.setDefaultEventListener(updateLists);
networkcube.addEventListener('searchResult', searchResultHandler);
createSelectionCategory('Node Selections', 'node');
createSelectionCategory('Link Selections', 'link');
createSelectionCategory('Measure Selections', 'measure');
updateLists();
function createSelectionCategory(name, type) {
    var nodeDiv = d3.select('body').append('div')
        .attr('id', 'div_' + type);
    nodeDiv.append('p')
        .attr('id', 'title_' + type)
        .html(name + ':');
    nodeDiv.append('input')
        .datum(type)
        .attr('type', 'button')
        .attr('value', '+')
        .on('click', function (d) { createSelection(d); });
}
function createSelection(type) {
    var b = networkcube.createSelection(type);
    var timer = setTimeout(function (e) {
        networkcube.setCurrentSelection(b);
        updateLists();
    }, 500);
}
function updateLists() {
    updateList('node', 'Node Selections');
    updateList('link', 'Link Selections');
    updateMeasureList('measure', 'Measure Selections');
    d3.selectAll('.icon_showColor')
        .attr('xlink:href', function (d) { if (d.showColor)
        return 'drop-full.png'; return 'drop-empty.png'; });
    d3.selectAll('.icon_eye')
        .attr('xlink:href', function (d) { if (d.filter)
        return 'eye-blind.png'; return 'eye-seeing.png'; });
    d3.selectAll('.selectionLabel')
        .text(function (d) { return d.name + ' (' + d.elementIds.length + ')'; });
}

function measureCheckboxChange(id){
  console.log("dooot")
  networkcube.updateActiveMeasures(id)
  networkcube.measureChange();
}


function updateMeasureList() {
    var measures = ['Connected Nodes', 'Edges', 'Clusters', 'Density', 'Connected Components', 'Diameter', 'Centrality', 'Volatility']
    var title = d3.select('#title_measure');
    title.html('Measure Selections' + ' (' + measures.length + ')');

    d3.select('#div_measure')
        .selectAll('.selectionDiv_measure')
        .remove();
    var measureGs = d3.select('#div_measure')
        .selectAll('.selectionDiv_measure')
        .data(measures)
        .enter()
        .append('div')
        .attr('height', LINE_HEIGHT)
        .attr('width', width)
//        .append('text')
//        .attr('x', '23')
//        .attr('y', '10.4')
//        .style('font-size', '13px')
//        .text(function(d){
//            return d;
//        }).append('svg')
//        .attr('height', LINE_HEIGHT)
//        .attr('width', width)

    measureGs.append('text')
        .attr('x', '23')
        .attr('y', '10.4')
        .style('font-size', '13px')
        .text(function(d){
            return d;
        })
        .append('br')
    measureGs.append('input')
        .attr('type', 'checkbox')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', RECT_SIZE)
        .attr('height', RECT_SIZE)
        .attr('id', function (d) { return "checkbox-" + d.toLowerCase().replace(/\s/g, ''); })
        .attr('onclick', "measureCheckboxChange(this.id)")
        .style('fill', function (d) { return "red"; });
/*
        .attr('font-family', 'Helvetica')
        .attr('x', RECT_SIZE + 10)
        .attr('y', RECT_SIZE * .8)
        .append('br');

        .attr('class', 'selectionDiv_measure')
        .attr('height', LINE_HEIGHT)
        .append('svg')
        .attr('class', 'svg_measure')
        .attr('height', LINE_HEIGHT)
        .attr('width', width)
        .append('g')
        .attr('transform', 'translate(' + INTENT + ',0)');
*/
}

function updateList(type, name) {
    var selections = dgraph.getSelections(type);
    console.log(selections)
    var title = d3.select('#title_' + type);
    title.html(name + ' (' + selections.length + ')');
    d3.select('#div_' + type)
        .selectAll('.selectionDiv_' + type)
        .remove();
    var nodeGs = d3.select('#div_' + type)
        .selectAll('.selectionDiv_' + type)
        .data(selections.sort(networkcube.sortByPriority))
        .enter()
        .append('div')
        .attr('class', 'selectionDiv_' + type)
        .attr('height', LINE_HEIGHT)
        .append('svg')
        .attr('class', 'svg_' + type)
        .attr('height', LINE_HEIGHT)
        .attr('width', width)
        .append('g')
        .attr('transform', 'translate(' + INTENT + ',0)');
    d3.selectAll('.selectionDiv_' + type)
        .style('background-color', function (d) {
        if (dgraph.currentSelection_id == d.id)
            return '#cccccc';
        return '#ffffff';
    });
    nodeGs.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', RECT_SIZE)
        .attr('height', RECT_SIZE)
        .style('fill', function (d) { return d.color; })
        .on('click', function (d) {
        networkcube.setSelectionColor(d, '#' + Math.floor(Math.random() * 16777215).toString(16));
    });
    nodeGs.append('text')
        .attr('class', 'selectionLabel')
        .text(function (d) {
        return d.name;
    })
        .style('font-size', RECT_SIZE)
        .style('font-family', 'Helvetica')
        .attr('x', RECT_SIZE + 10)
        .attr('y', RECT_SIZE * .8)
        .on('click', function (d) {
        networkcube.setCurrentSelection(d);
        updateLists();
    });
    var i = 0;
    nodeGs.append('svg:image')
        .attr('class', 'icon_showColor icon')
        .attr('x', 130 + (RECT_SIZE + GAP_ICONS) * i++)
        .on('click', function (d, i) {
        networkcube.showSelectionColor(d, !d.showColor);
    });
    nodeGs.append('svg:image')
        .attr('id', 'eye_' + name)
        .attr('class', 'icon_eye icon')
        .attr('xlink:href', 'eye-visible.png')
        .attr('x', 130 + (RECT_SIZE + GAP_ICONS) * i++)
        .on('click', function (d, i) {
        networkcube.filterSelection(d, !d.filter);
    });
    nodeGs.append('svg:image')
        .filter(function (d) { return d.name.indexOf('Unselected') == -1; })
        .attr('class', 'icon')
        .attr('xlink:href', 'up.png')
        .attr('x', 130 + (RECT_SIZE + GAP_ICONS) * i++)
        .on('click', function (d, i) {
        if (i > 0)
            networkcube.swapPriority(d, d3.selectAll('.selectionDiv_' + d.acceptedType).data()[i - 1]);
    });
    nodeGs.append('svg:image')
        .filter(function (d) { return d.name.indexOf('Unselected') == -1; })
        .attr('class', 'icon')
        .attr('xlink:href', 'down.png')
        .attr('x', 130 + (RECT_SIZE + GAP_ICONS) * i++)
        .on('click', function (d, i) {
        if (d3.selectAll('.selectionDiv_' + d.acceptedType).data()[i + 1])
            networkcube.swapPriority(d, d3.selectAll('.selectionDiv_' + d.acceptedType).data()[i + 1]);
    });
    nodeGs.append('svg:image')
        .filter(function (d) { return d.name.indexOf('Unselected') == -1; })
        .attr('class', 'icon')
        .attr('xlink:href', 'delete.png')
        .attr('x', 130 + (RECT_SIZE + GAP_ICONS) * i++)
        .on('click', function (d, i) {
        console.log('CLICK');
        networkcube.deleteSelection(d);
    });
    nodeGs.selectAll('.icon')
        .attr('height', RECT_SIZE)
        .attr('width', RECT_SIZE);
}
var searchMessage;
function searchResultHandler(m) {
    searchMessage = m;
    $('#searchResults').empty();
    var row = $('#searchResults').append('<li></li>');
    if (m.idCompound.nodeIds)
        row.append('<p class="searchResult">Nodes: <b>' + m.idCompound.nodeIds.length + '</b> <u onclick="saveSearchResultAsSelection(\'node\')">(Save as selection)</u></p>');
    if (m.idCompound.linkIds)
        row.append('<p class="searchResult">Links: <b>' + m.idCompound.linkIds.length + '</b> <u onclick="saveSearchResultAsSelection(\'link\')">(Save as selection)</u></p>');
}
function saveSearchResultAsSelection(type) {
    var s = networkcube.createSelection(type, searchMessage.searchTerm);
    var selectionIdCompound = new networkcube.IDCompound();
    selectionIdCompound[type + 'Ids'] = searchMessage.idCompound[type + 'Ids'];
    var temp = networkcube.makeElementCompound(selectionIdCompound, dgraph);
    window.setTimeout(function () {
        console.log('set selection', selectionIdCompound, s.id);
        networkcube.highlight('reset');
        window.setTimeout(function () {
            networkcube.selection('set', networkcube.makeElementCompound(selectionIdCompound, dgraph), s.id);
        }, 1000);
    }, 1000);
}
function clearSearchSelection() {
    networkcube.highlight('reset');
    $('#searchResults').empty();
}

// Slice Creator with vis.js
let network = null;
let nodes = null;
let edges = null;
let topologies = [];
let topologyCounter = 0;
let currentNodeId = 0;
let currentEdgeId = 0;
let selectedNode = null;
let isConnectingMode = false;
let connectingFrom = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateTopologyCounter();
});

function initializeEventListeners() {
    // Add topology button
    document.getElementById('addTopologyBtn').addEventListener('click', function() {
        if (topologyCounter < 3) {
            openTopologyModal();
        } else {
            alert('Máximo 3 topologías permitidas');
        }
    });

    // Topology modal buttons
    document.getElementById('acceptTopologyBtn').addEventListener('click', addTopology);
    document.getElementById('cancelTopologyBtn').addEventListener('click', closeTopologyModal);
    document.getElementById('closeTopologyModal').addEventListener('click', closeTopologyModal);

    // VM modal buttons
    document.getElementById('saveVmBtn').addEventListener('click', saveVmConfig);
    document.getElementById('cancelVmBtn').addEventListener('click', closeVmModal);
    document.getElementById('closeVmModal').addEventListener('click', closeVmModal);

    // Create slice button
    document.getElementById('createSliceBtn').addEventListener('click', createSlice);

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

function openTopologyModal() {
    document.getElementById('topologyName').value = 'Topología ' + (topologyCounter + 1);
    document.getElementById('topologyModal').style.display = 'block';
}

function closeTopologyModal() {
    document.getElementById('topologyModal').style.display = 'none';
}

function openVmModal(nodeId) {
    selectedNode = nodeId;
    const node = nodes.get(nodeId);
    document.getElementById('vmName').value = node.label;
    document.getElementById('vmFlavor').value = node.flavor || 'f1';
    document.getElementById('vmInternet').checked = node.internet || false;
    document.getElementById('vmModal').style.display = 'block';
}

function closeVmModal() {
    document.getElementById('vmModal').style.display = 'none';
    selectedNode = null;
}

function saveVmConfig() {
    if (selectedNode) {
        const name = document.getElementById('vmName').value;
        const flavor = document.getElementById('vmFlavor').value;
        const internet = document.getElementById('vmInternet').checked;
        
        nodes.update({
            id: selectedNode,
            label: name,
            flavor: flavor,
            internet: internet
        });
    }
    closeVmModal();
}

function addTopology() {
    const name = document.getElementById('topologyName').value;
    const type = document.getElementById('topologyType').value;
    const vmCount = parseInt(document.getElementById('vmCount').value);

    if (!name || !type) {
        alert('Por favor complete todos los campos');
        return;
    }

    if (!network) {
        initializeNetwork();
    }

    const topology = createTopologyNodes(name, type, vmCount, topologyCounter);
    topologies.push(topology);
    topologyCounter++;
    
    updateTopologyCounter();
    updateCreateButton();
    closeTopologyModal();

    // Hide placeholder
    document.getElementById('canvasPlaceholder').style.display = 'none';
    const networkDiv = document.getElementById('network'); networkDiv.style.display = 'block'; networkDiv.style.width = '100%'; networkDiv.style.height = '100%';
}

function initializeNetwork() {
    const container = document.getElementById('network');
    
    nodes = new vis.DataSet([]);
    edges = new vis.DataSet([]);

    const data = { nodes: nodes, edges: edges };
    const options = {
        nodes: {
            shape: 'box',
            margin: 10,
            widthConstraint: { minimum: 80, maximum: 120 },
            font: { size: 12, color: '#ffffff' },
            color: {
                background: '#667eea',
                border: '#5a67d8',
                highlight: {
                    background: '#5a67d8',
                    border: '#4c51bf'
                }
            },
            borderWidth: 2,
            borderWidthSelected: 3,
            shadow: true
        },
        edges: {
            width: 2,
            color: { color: '#94a3b8', highlight: '#667eea' },
            smooth: { type: 'continuous' },
            arrows: { to: false }
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.3,
                springLength: 150,
                springConstant: 0.04
            },
            stabilization: { iterations: 200 }
        },
        interaction: {
            dragNodes: true,
            dragView: true,
            zoomView: true
        },
        manipulation: {
            enabled: false
        }
    };

    network = new vis.Network(container, data, options);

    // Double click to configure VM
    network.on('doubleClick', function(params) {
        if (params.nodes.length > 0) {
            openVmModal(params.nodes[0]);
        }
    });

    // Single click for connecting topologies
    network.on('click', function(params) {
        if (params.nodes.length > 0 && isConnectingMode) {
            const nodeId = params.nodes[0];
            if (!connectingFrom) {
                connectingFrom = nodeId;
                network.selectNodes([nodeId]);
            } else if (connectingFrom !== nodeId) {
                // Check if nodes are from different topologies
                const node1 = nodes.get(connectingFrom);
                const node2 = nodes.get(nodeId);
                if (node1.topologyId !== node2.topologyId) {
                    addEdgeBetweenTopologies(connectingFrom, nodeId);
                }
                connectingFrom = null;
                isConnectingMode = false;
                network.unselectAll();
            }
        }
    });
}

function createTopologyNodes(name, type, vmCount, topologyId) {
    const newNodes = [];
    const newEdges = [];
    const startId = currentNodeId;

    // Calculate position for this topology
    const xOffset = (topologyId % 2) * 300 - 150;
    const yOffset = Math.floor(topologyId / 2) * 300;

    // Create nodes
    for (let i = 0; i < vmCount; i++) {
        const nodeId = currentNodeId++;
        newNodes.push({
            id: nodeId,
            label: `${name}-VM${i + 1}`,
            topologyId: topologyId,
            topologyName: name,
            flavor: 'f1',
            internet: false,
            x: xOffset,
            y: yOffset
        });
    }

    // Create edges based on topology type
    switch(type) {
        case 'anillo': // Ring
            for (let i = 0; i < vmCount; i++) {
                const from = startId + i;
                const to = startId + ((i + 1) % vmCount);
                newEdges.push({ id: currentEdgeId++, from: from, to: to });
            }
            break;
        case 'estrella': // Star
            const center = startId;
            for (let i = 1; i < vmCount; i++) {
                newEdges.push({ id: currentEdgeId++, from: center, to: startId + i });
            }
            break;
        case 'malla': // Mesh
            for (let i = 0; i < vmCount; i++) {
                for (let j = i + 1; j < vmCount; j++) {
                    newEdges.push({ id: currentEdgeId++, from: startId + i, to: startId + j });
                }
            }
            break;
        case 'arbol': // Tree
            for (let i = 1; i < vmCount; i++) {
                const parent = startId + Math.floor((i - 1) / 2);
                newEdges.push({ id: currentEdgeId++, from: parent, to: startId + i });
            }
            break;
    }

    nodes.add(newNodes);
    edges.add(newEdges);

    return { id: topologyId, name: name, type: type, nodes: newNodes.map(n => n.id) };
}

function addEdgeBetweenTopologies(from, to) {
    // Check if edge already exists
    const existingEdges = edges.get();
    const edgeExists = existingEdges.some(e => 
        (e.from === from && e.to === to) || (e.from === to && e.to === from)
    );

    if (!edgeExists) {
        edges.add({
            id: currentEdgeId++,
            from: from,
            to: to,
            color: { color: '#f59e0b', highlight: '#d97706' },
            width: 3,
            dashes: true
        });
    }
}

function updateTopologyCounter() {
    document.getElementById('topologyCounter').textContent = `${topologyCounter}/3 topologías`;
    
    if (topologyCounter >= 3) {
        document.getElementById('addTopologyBtn').disabled = true;
        document.getElementById('addTopologyBtn').style.opacity = '0.5';
        document.getElementById('addTopologyBtn').style.cursor = 'not-allowed';
    }
}

function updateCreateButton() {
    const createBtn = document.getElementById('createSliceBtn');
    if (topologyCounter > 0) {
        createBtn.disabled = false;
        createBtn.style.opacity = '1';
        createBtn.style.cursor = 'pointer';
    }
}

function createSlice() {
    const sliceName = document.getElementById('sliceName').value;
    
    if (!sliceName) {
        alert('Por favor ingrese un nombre para el slice');
        return;
    }

    if (topologies.length === 0) {
        alert('Por favor agregue al menos una topología');
        return;
    }

    // Collect all VM data
    const vms = nodes.get().map(node => ({
        name: node.label,
        flavor: node.flavor || 'f1',
        internet: node.internet || false,
        topology: node.topologyName
    }));

    // Collect all connections
    const connections = edges.get().map(edge => ({
        from: nodes.get(edge.from).label,
        to: nodes.get(edge.to).label
    }));

    const sliceData = {
        name: sliceName,
        topologies: topologies.map(t => ({
            name: t.name,
            type: t.type,
            vms: vms.filter(vm => vm.topology === t.name)
        })),
        connections: connections
    };

    // Send to server
    fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sliceData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Slice creado exitosamente');
            window.location.href = indexUrl;
        } else {
            alert('Error: ' + (data.error || 'No se pudo crear el slice'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al crear el slice');
    });
}

// Enable connecting mode with Ctrl+Click
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && topologies.length > 1) {
        isConnectingMode = true;
        document.body.style.cursor = 'crosshair';
    }
});

document.addEventListener('keyup', function(e) {
    if (!e.ctrlKey) {
        isConnectingMode = false;
        connectingFrom = null;
        document.body.style.cursor = 'default';
        if (network) network.unselectAll();
    }
});


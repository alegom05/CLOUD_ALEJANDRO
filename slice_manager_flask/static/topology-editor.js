let network = null;
let nodes = new vis.DataSet([]);
let edges = new vis.DataSet([]);
let topologies = [];
let topologyCounter = 0;

// Initialize network on page load
document.addEventListener('DOMContentLoaded', function() {
  initNetwork();
  setupEventListeners();
});

function initNetwork() {
  const container = document.getElementById('networkCanvas');
  const data = { nodes: nodes, edges: edges };
  
  const options = {
    nodes: {
      shape: 'box',
      margin: 10,
      widthConstraint: { minimum: 80, maximum: 100 },
      font: { 
        size: 14, 
        color: '#ffffff',
        bold: { color: '#ffffff' }
      },
      borderWidth: 2,
      color: {
        border: '#667eea',
        background: '#764ba2',
        highlight: { 
          border: '#4f46e5', 
          background: '#667eea' 
        }
      },
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.2)',
        size: 10,
        x: 2,
        y: 2
      }
    },
    edges: {
      width: 2,
      color: { 
        color: '#94a3b8', 
        highlight: '#667eea',
        hover: '#667eea'
      },
      smooth: { 
        type: 'continuous',
        roundness: 0.5
      },
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.1)',
        size: 5,
        x: 1,
        y: 1
      }
    },
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -3000,
        centralGravity: 0.3,
        springLength: 150,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 0.5
      },
      stabilization: {
        iterations: 200,
        updateInterval: 25
      }
    },
    interaction: { 
      hover: true,
      navigationButtons: false,
      keyboard: false
    }
  };
  
  network = new vis.Network(container, data, options);
  
  // Click event on nodes to configure VM
  network.on('click', function(params) {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      openVMConfigModal(nodeId);
    }
  });
}

function setupEventListeners() {
  // Add topology button
  document.getElementById('addTopologyBtn').addEventListener('click', addTopology);
  
  // Deploy button
  document.getElementById('deployBtn').addEventListener('click', deploySlice);
  
  // Zoom controls
  document.getElementById('zoomInBtn').addEventListener('click', function() {
    network.moveTo({ scale: network.getScale() * 1.2 });
  });
  
  document.getElementById('zoomOutBtn').addEventListener('click', function() {
    network.moveTo({ scale: network.getScale() * 0.8 });
  });
  
  document.getElementById('zoomFitBtn').addEventListener('click', function() {
    network.fit({
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad'
      }
    });
  });
}

function addTopology() {
  const topologyType = document.getElementById('topologySelect').value;
  const numNodes = parseInt(document.getElementById('numNodes').value);
  
  if (!topologyType) {
    alert('Por favor seleccione un tipo de topología');
    return;
  }
  
  if (topologies.length >= 3) {
    alert('Máximo 3 topologías permitidas');
    return;
  }
  
  topologyCounter++;
  const topologyId = 'topo-' + topologyCounter;
  
  createTopology(topologyId, topologyType, numNodes);
  
  topologies.push({
    id: topologyId,
    type: topologyType,
    nodes: numNodes
  });
  
  // Enable deploy button
  document.getElementById('deployBtn').disabled = false;
  
  // Reset selects
  document.getElementById('topologySelect').value = '';
  
  // Fit view to show all nodes
  setTimeout(function() {
    network.fit({
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad'
      }
    });
  }, 100);
}

function createTopology(topologyId, type, numNodes) {
  // Calculate base position for this topology
  const baseX = (topologies.length) * 400;
  const baseY = 0;
  const newNodes = [];
  const newEdges = [];
  
  // Create nodes based on topology type
  for (let i = 0; i < numNodes; i++) {
    const nodeId = topologyId + '-node-' + (i + 1);
    let x, y;
    
    if (type === 'anillo') {
      // Ring topology
      const angle = (i * 2 * Math.PI) / numNodes;
      const radius = 120;
      x = baseX + Math.cos(angle) * radius;
      y = baseY + Math.sin(angle) * radius;
      
    } else if (type === 'estrella') {
      // Star topology
      if (i === 0) {
        x = baseX;
        y = baseY;
      } else {
        const angle = ((i - 1) * 2 * Math.PI) / (numNodes - 1);
        const radius = 150;
        x = baseX + Math.cos(angle) * radius;
        y = baseY + Math.sin(angle) * radius;
      }
      
    } else if (type === 'arbol') {
      // Tree topology
      const level = Math.floor(Math.log2(i + 1));
      const posInLevel = (i + 1) - Math.pow(2, level);
      const nodesInLevel = Math.pow(2, level);
      x = baseX + (posInLevel - nodesInLevel / 2 + 0.5) * 100;
      y = baseY + level * 120;
      
    } else if (type === 'malla') {
      // Mesh topology
      const cols = Math.ceil(Math.sqrt(numNodes));
      const row = Math.floor(i / cols);
      const col = i % cols;
      x = baseX + (col - (cols - 1) / 2) * 100;
      y = baseY + (row - Math.floor(numNodes / cols) / 2) * 100;
    }
    
    newNodes.push({
      id: nodeId,
      label: 'VM' + (i + 1),
      x: x,
      y: y,
      topologyId: topologyId,
      flavor: 'f1',
      internet: false,
      vmName: 'VM' + (i + 1)
    });
  }
  
  // Create edges based on topology type
  for (let i = 0; i < numNodes; i++) {
    const fromId = topologyId + '-node-' + (i + 1);
    
    if (type === 'anillo') {
      // Ring: connect each node to next (circular)
      const toId = topologyId + '-node-' + ((i % numNodes) + 1);
      if (i < numNodes - 1 || numNodes > 2) {
        newEdges.push({ 
          id: 'edge-' + fromId + '-' + toId,
          from: fromId, 
          to: topologyId + '-node-' + (((i + 1) % numNodes) + 1)
        });
      }
      
    } else if (type === 'estrella') {
      // Star: connect all to central node (node 0)
      if (i > 0) {
        const centralId = topologyId + '-node-1';
        newEdges.push({ 
          id: 'edge-' + fromId + '-' + centralId,
          from: fromId, 
          to: centralId 
        });
      }
      
    } else if (type === 'arbol') {
      // Tree: connect to parent node
      if (i > 0) {
        const parentIndex = Math.floor((i + 1) / 2);
        const parentId = topologyId + '-node-' + parentIndex;
        newEdges.push({ 
          id: 'edge-' + fromId + '-' + parentId,
          from: fromId, 
          to: parentId 
        });
      }
      
    } else if (type === 'malla') {
      // Mesh: connect to all other nodes
      for (let j = i + 1; j < numNodes; j++) {
        const toId = topologyId + '-node-' + (j + 1);
        newEdges.push({ 
          id: 'edge-' + fromId + '-' + toId,
          from: fromId, 
          to: toId 
        });
      }
    }
  }
  
  // Add nodes and edges to network
  nodes.add(newNodes);
  edges.add(newEdges);
  
  // Stabilize network
  network.stabilize();
}

function openVMConfigModal(nodeId) {
  const node = nodes.get(nodeId);
  if (!node) return;
  
  const vmName = prompt('Nombre de la VM:', node.vmName || node.label);
  if (vmName === null) return;
  
  const flavorOptions = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
  const flavorChoice = prompt('Flavor (f1-f6):', node.flavor);
  if (flavorChoice === null) return;
  
  const internetChoice = confirm('¿Acceso a Internet?');
  
  nodes.update({
    id: nodeId,
    vmName: vmName,
    label: vmName,
    flavor: flavorChoice,
    internet: internetChoice
  });
}

function deploySlice() {
  const sliceName = document.getElementById('sliceName').value.trim();
  
  if (!sliceName) {
    alert('Por favor ingrese un nombre para el slice');
    return;
  }
  
  if (topologies.length === 0) {
    alert('Por favor agregue al menos una topología');
    return;
  }
  
  const sliceData = {
    name: sliceName,
    topologies: topologies,
    vms: nodes.get(),
    links: edges.get()
  };
  
  console.log('Deploying slice:', sliceData);
  
  // Send to backend
  fetch('/create_slice', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(sliceData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Slice creado exitosamente');
      window.location.href = '/';
    } else {
      alert('Error al crear el slice: ' + (data.error || 'Error desconocido'));
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error de conexión al crear el slice');
  });
}

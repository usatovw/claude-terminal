class PresenceManager {
  constructor() {
    this.peers = new Map();   // peerId → { ws, name, colorIndex, sessionId }
    this.nextColorIndex = 0;  // round-robin across 12 colors
  }

  addPeer(peerId, ws, name) {
    const colorIndex = this.nextColorIndex % 12;
    this.nextColorIndex++;
    this.peers.set(peerId, { ws, name, colorIndex, sessionId: null });
    return { colorIndex };
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    const sessionId = peer.sessionId;
    this.peers.delete(peerId);
    if (sessionId) {
      this._broadcastPeerLeft(peerId, sessionId);
      this._broadcastSessionPeers();
    }
  }

  joinSession(peerId, sessionId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    // Leave old session
    if (peer.sessionId && peer.sessionId !== sessionId) {
      this._broadcastPeerLeft(peerId, peer.sessionId);
    }
    peer.sessionId = sessionId;
    this._broadcastPeersInSession(sessionId);
    this._broadcastSessionPeers();
  }

  handleCursor(peerId, cursorData) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.sessionId) return;
    const msg = JSON.stringify({
      type: "cursor", peerId,
      x: cursorData.x, yBot: cursorData.yBot, vh: cursorData.vh,
      name: peer.name, colorIndex: peer.colorIndex,
    });
    for (const [id, p] of this.peers) {
      if (id !== peerId && p.sessionId === peer.sessionId && p.ws.readyState === 1) {
        p.ws.send(msg);
      }
    }
  }

  handleChat(peerId, text) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.sessionId) return;
    // Include name + colorIndex so receiver can render even without prior peers broadcast
    const msg = JSON.stringify({
      type: "chat", peerId, text,
      name: peer.name, colorIndex: peer.colorIndex,
    });
    for (const [id, p] of this.peers) {
      if (id !== peerId && p.sessionId === peer.sessionId && p.ws.readyState === 1) {
        p.ws.send(msg);
      }
    }
  }

  handleChatClose(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.sessionId) return;
    const msg = JSON.stringify({ type: "chat_close", peerId });
    for (const [id, p] of this.peers) {
      if (id !== peerId && p.sessionId === peer.sessionId && p.ws.readyState === 1) {
        p.ws.send(msg);
      }
    }
  }

  _broadcastPeersInSession(sessionId) {
    const peersInSession = [];
    for (const [id, peer] of this.peers) {
      if (peer.sessionId === sessionId) {
        peersInSession.push({ peerId: id, name: peer.name, colorIndex: peer.colorIndex, sessionId });
      }
    }
    const msg = JSON.stringify({ type: "peers", peers: peersInSession });
    for (const [, peer] of this.peers) {
      if (peer.sessionId === sessionId && peer.ws.readyState === 1) {
        peer.ws.send(msg);
      }
    }
  }

  _broadcastPeerLeft(peerId, sessionId) {
    const msg = JSON.stringify({ type: "peer_left", peerId });
    for (const [id, p] of this.peers) {
      if (id !== peerId && p.sessionId === sessionId && p.ws.readyState === 1) {
        p.ws.send(msg);
      }
    }
  }

  _broadcastSessionPeers() {
    const sessions = {};
    for (const [id, peer] of this.peers) {
      if (peer.sessionId) {
        if (!sessions[peer.sessionId]) sessions[peer.sessionId] = [];
        sessions[peer.sessionId].push({ peerId: id, name: peer.name, colorIndex: peer.colorIndex });
      }
    }
    const msg = JSON.stringify({ type: "session_peers", sessions });
    for (const [, peer] of this.peers) {
      if (peer.ws.readyState === 1) {
        peer.ws.send(msg);
      }
    }
  }
}

module.exports = { PresenceManager };

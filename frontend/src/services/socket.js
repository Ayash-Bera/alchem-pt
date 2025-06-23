import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:8080';

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect() {
        this.socket = io(SOCKET_URL, {
            transports: ['websocket'],
            upgrade: true
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
        });

        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    getSocket() {
        return this.socket;
    }
}

// Create and export instance
const socketService = new SocketService();
export default socketService;
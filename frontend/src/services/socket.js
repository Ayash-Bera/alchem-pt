import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://34.68.86.10:8080';

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect() {
        console.log('🔌 Attempting to connect to:', SOCKET_URL);
        this.socket = io(SOCKET_URL, {
            transports: ['polling', 'websocket'],
            forceNew: true,
            reconnection: true,
            timeout: 20000
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket connected to:', SOCKET_URL);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
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
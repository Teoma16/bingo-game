import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import axios from 'axios';
import './GameRoom.css';
import Confetti from 'react-confetti';

const GameRoom = ({ user }) => {
  const { gameId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [calledNumbersWithLetters, setCalledNumbersWithLetters] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [currentNumberWithLetter, setCurrentNumberWithLetter] = useState(null);
  const [prizePool, setPrizePool] = useState(location.state?.prizePool || 0);
  const [winnerAmount, setWinnerAmount] = useState(location.state?.winnerAmount || 0);
  const [gameActive, setGameActive] = useState(true);
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState([]);
  const [autoMark, setAutoMark] = useState(true);
  const [callCount, setCallCount] = useState(0);
  const [gameNumber, setGameNumber] = useState(location.state?.gameNumber || 0);
  const [currentGameId, setCurrentGameId] = useState(null);
  const [winner, setWinner] = useState(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const API_URL = 'https://bingo-game-production-dd0b.up.railway.app';

  const numberToLetter = (number) => {
    if (number >= 1 && number <= 15) return `B${number}`;
    if (number >= 16 && number <= 30) return `I${number}`;
    if (number >= 31 && number <= 45) return `N${number}`;
    if (number >= 46 && number <= 60) return `G${number}`;
    if (number >= 61 && number <= 75) return `O${number}`;
    return number.toString();
  };

  // Load cartelas from location state or localStorage
  useEffect(() => {
    console.log('=== GAMEROOM LOADING CARTELAS ===');
    console.log('Location state:', location.state);
    
    let cartelas = [];
    
    if (location.state?.selectedCartelas && location.state.selectedCartelas.length > 0) {
      cartelas = location.state.selectedCartelas;
      console.log('Got cartelas from location state:', cartelas.length);
    } else {
      const savedCartelas = localStorage.getItem('userCartelas');
      if (savedCartelas) {
        cartelas = JSON.parse(savedCartelas);
        console.log('Got cartelas from localStorage:', cartelas.length);
      }
    }
    
    setSelectedCartelas(cartelas);
  }, [location.state]);

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      if (user && user.id) {
        newSocket.emit('register-player', {
          userId: user.id,
          phoneNumber: user.phone_number
        });
      }
    });
    
    newSocket.on('connect_error', (error) => {
      console.log('❌ WebSocket error:', error);
    });
    
    newSocket.on('game-started', (data) => {
      console.log('Game started:', data);
      setCurrentGameId(data.gameId);
      setGameNumber(data.gameNumber);
      setPrizePool(data.prizePool);
      setWinnerAmount(data.winnerAmount);
      toast.success(data.message);
    });
    
    newSocket.on('number-called', (data) => {
      console.log('Number called:', data.number);
      
      if (!markedNumbers.includes(data.number)) {
        setMarkedNumbers(prev => [...prev, data.number]);
        if (newSocket && newSocket.connected) {
          newSocket.emit('auto-mark', {
            userId: user.id,
            number: data.number
          });
        }
      }
      
      const numberWithLetter = numberToLetter(data.number);
      setCurrentNumber(data.number);
      setCurrentNumberWithLetter(numberWithLetter);
      setCalledNumbers(data.calledNumbers);
      setCallCount(data.callCount);
    });
    
    newSocket.on('game-ended', (data) => {
      console.log('Game ended:', data);
      
      if (data.winners && data.winners.length > 0 && data.winners[0].userId === user?.id) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
      
      if (data.winners && data.winners.length > 0) {
        const winnerData = data.winners[0];
        setWinner({
          userId: winnerData.userId,
          username: winnerData.username || `Player ${winnerData.userId}`,
          amount: winnerData.amount
        });
        setShowWinnerModal(true);
      }
      
      setGameActive(false);
      localStorage.removeItem('userCartelas');
    });
    
    newSocket.on('invalid-bingo', (data) => {
      toast.error(data.message);
    });
    
    newSocket.on('game-update', (data) => {
      if (data.prizePool) {
        setPrizePool(data.prizePool);
        setWinnerAmount(data.prizePool * 0.81);
      }
    });
    
    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (showWinnerModal) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWinnerModal, navigate]);

  const handlePressBingo = () => {
    if (socket && socket.connected) {
      socket.emit('press-bingo', {
        userId: user.id,
        gameId: currentGameId || location.state?.gameId
      });
      toast('BINGO! Checking your cards...');
    }
  };

  const convertToGrid = (cartelaData) => {
    const grid = [];
    for (let row = 0; row < 5; row++) {
      grid.push([
        cartelaData.B[row],
        cartelaData.I[row],
        cartelaData.N[row],
        cartelaData.G[row],
        cartelaData.O[row]
      ]);
    }
    return grid;
  };

  const renderCartela = (cartela, index) => {
    if (!cartela || !cartela.card_data) {
      return (
        <div key={index} className="game-cartela">
          <p>Invalid cartela data</p>
        </div>
      );
    }
    
    const grid = convertToGrid(cartela.card_data);
    
    return (
      <div key={index} className="game-cartela">
        <h4>Cartela #{cartela.lucky_number}</h4>
        <table className="bingo-card">
          <thead>
            <tr>
              <th>B</th>
              <th>I</th>
              <th>N</th>
              <th>G</th>
              <th>O</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => {
                  const isMarked = markedNumbers.includes(cell) || cell === 'FREE';
                  return (
                    <td 
                      key={colIndex} 
                      className={`${isMarked ? 'marked' : ''} ${cell === 'FREE' ? 'free-space' : ''}`}
                    >
                      {cell === 'FREE' ? '⭐' : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBingoBoard = () => {
    const calledMap = new Set(calledNumbers);
    const columns = { B: [], I: [], N: [], G: [], O: [] };
    
    for (let i = 1; i <= 15; i++) columns.B.push({ number: i, called: calledMap.has(i), display: `B${i}` });
    for (let i = 16; i <= 30; i++) columns.I.push({ number: i, called: calledMap.has(i), display: `I${i}` });
    for (let i = 31; i <= 45; i++) columns.N.push({ number: i, called: calledMap.has(i), display: `N${i}` });
    for (let i = 46; i <= 60; i++) columns.G.push({ number: i, called: calledMap.has(i), display: `G${i}` });
    for (let i = 61; i <= 75; i++) columns.O.push({ number: i, called: calledMap.has(i), display: `O${i}` });
    
    return (
      <div className="bingo-board-full">
        <h3>🎯 Called Numbers Board</h3>
        <div className="bingo-columns">
          {Object.entries(columns).map(([letter, numbers]) => (
            <div key={letter} className="bingo-column-full">
              <div className="column-header">{letter}</div>
              <div className="column-numbers-full">
                {numbers.map((item) => (
                  <div key={item.number} className={`bingo-number ${item.called ? 'called' : ''}`}>
                    {item.display}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRecentCalls = () => {
    const recentCalls = [...calledNumbersWithLetters].reverse().slice(0, 12);
    return (
      <div className="recent-calls">
        <h3>📢 Recent Calls</h3>
        <div className="recent-calls-list">
          {recentCalls.map((call, idx) => (
            <span key={idx} className="recent-call">{call}</span>
          ))}
          {recentCalls.length === 0 && <span>Waiting for first call...</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="game-room">
      <div className="game-header">
        <div className="game-title">
          <h2>🎯 BINGO GAME #{gameNumber}</h2>
        </div>
        <div className="current-number-display">
          <span className="current-label">Current Number:</span>
          <span className="current-number">{currentNumberWithLetter || '---'}</span>
        </div>
        <div className="call-count">📞 Calls: {callCount}/75</div>
        <div className="prize-info">
          <div className="winner-prize-display">🏆 Winner Gets: {winnerAmount.toFixed(2)} Birr</div>
        </div>
        <div className="game-controls">
          <button className="mode-toggle" onClick={() => setAutoMark(!autoMark)}>
            {autoMark ? '🤖 Auto-Mark ON' : '✋ Manual-Mark OFF'}
          </button>
          <button className="bingo-button" onClick={handlePressBingo}>🎲 BINGO!</button>
        </div>
      </div>
      
      <div className="game-content">
        <div className="cartelas-section">
          <h3>Your Cartelas ({selectedCartelas.length}/2)</h3>
          <div className="cartelas-container">
            {selectedCartelas.length > 0 ? (
              selectedCartelas.map((cartela, idx) => renderCartela(cartela, idx))
            ) : (
              <div className="no-cartelas">
                <p>⚠️ No cartelas found!</p>
                <button onClick={() => navigate('/')} className="back-button">← Back to Home</button>
              </div>
            )}
          </div>
        </div>
        
        <div className="called-numbers-section">
          {renderRecentCalls()}
          {renderBingoBoard()}
        </div>
      </div>
      
      <div className="game-footer">
        <div className="game-status">
          {gameActive ? '🔴 Game In Progress' : '🏁 Game Ended'}
        </div>
      </div>
      
      {showConfetti && <Confetti />}
      
      {showWinnerModal && winner && (
        <div className="winner-modal-overlay">
          <div className="winner-modal">
            <div className="winner-fireworks">
              <div className="firework"></div>
              <div className="firework"></div>
              <div className="firework"></div>
              <div className="firework"></div>
              <div className="firework"></div>
            </div>
            <div className="winner-content">
              <div className="winner-trophy">🏆</div>
              <h1 className="winner-title">BINGO!</h1>
              <div className="winner-announcement">
                {winner.userId === user?.id ? (
                  <>
                    <p className="winner-congrats">🎉 CONGRATULATIONS! 🎉</p>
                    <p className="winner-message">YOU ARE THE WINNER!</p>
                    <div className="winner-amount">
                      <span className="amount-label">YOU WON</span>
                      <span className="amount-value">{winner.amount.toFixed(2)} Birr</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="winner-congrats">🎉 BINGO! 🎉</p>
                    <p className="winner-message">🏆 {winner.username} won the game! 🏆</p>
                    <div className="winner-amount">
                      <span className="amount-label">Prize Amount</span>
                      <span className="amount-value">{winner.amount.toFixed(2)} Birr</span>
                    </div>
                  </>
                )}
              </div>
              <div className="winner-redirect">Redirecting to home in 5 seconds...</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
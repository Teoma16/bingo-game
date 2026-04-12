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
    
    console.log('Final cartelas to display:', cartelas);
    setSelectedCartelas(cartelas);
    
    if (cartelas.length === 0 && user?.id) {
      console.log('No cartelas found, fetching from API...');
      fetchUserCartelas();
    }
  }, [location.state, user]);

  const fetchUserCartelas = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/game/user-cartelas/${user.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('API cartelas response:', response.data);
      if (response.data.cartelas && response.data.cartelas.length > 0) {
        setSelectedCartelas(response.data.cartelas);
        localStorage.setItem('userCartelas', JSON.stringify(response.data.cartelas));
      }
    } catch (error) {
      console.error('Failed to fetch cartelas:', error);
    }
  };

  const numberToLetter = (number) => {
    if (number >= 1 && number <= 15) return `B${number}`;
    if (number >= 16 && number <= 30) return `I${number}`;
    if (number >= 31 && number <= 45) return `N${number}`;
    if (number >= 46 && number <= 60) return `G${number}`;
    if (number >= 61 && number <= 75) return `O${number}`;
    return number.toString();
  };

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);
    
    if (user && user.id) {
      newSocket.emit('register-player', {
        userId: user.id,
        phoneNumber: user.phone_number
      });
    }
    
    newSocket.on('game-started', (data) => {
      console.log('Game started event received:', data);
	    console.log('🔥🔥🔥 GAME-STARTED EVENT FIRED! 🔥🔥🔥');
  console.log('Full data:', data);
      setCurrentGameId(data.gameId);
      setGameNumber(data.gameNumber);
      setPrizePool(data.prizePool);
      setWinnerAmount(data.winnerAmount);
      toast.success(data.message);
    });
    
 newSocket.on('number-called', (data) => {
  console.log('📞 NUMBER CALLED:', data.number);
  
  // CRITICAL: Mark the number immediately
  if (!markedNumbers.includes(data.number)) {
    setMarkedNumbers(prev => {
      const newMarked = [...prev, data.number];
      console.log(`✅ Marked ${data.number}. Total marked: ${newMarked.length}`);
      return newMarked;
    });
    
    // Send to server
    if (newSocket && newSocket.connected) {
      newSocket.emit('auto-mark', {
        userId: user.id,
        number: data.number
      });
    }
  }
  
  // Update UI
  const numberWithLetter = numberToLetter(data.number);
  setCurrentNumber(data.number);
  setCurrentNumberWithLetter(numberWithLetter);
  setCalledNumbers(data.calledNumbers);
  setCallCount(data.callCount);
});
    
    newSocket.on('game-ended', (data) => {
      console.log('Game ended data:', data);
      
      if (data.winners && data.winners.length > 0 && data.winners[0].userId === user?.id) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
      
      if (data.winners && data.winners.length > 0) {
        const winnerData = data.winners[0];
        setWinner({
          userId: winnerData.userId,
          username: winnerData.username || `Player ${winnerData.userId}`,
          amount: winnerData.amount,
          totalAmount: winnerData.totalAmount || winnerData.amount,
          bonus: winnerData.bonus || 0
        });
        setShowWinnerModal(true);
      }
      
      setGameActive(false);
      localStorage.removeItem('userCartelas');
    });
    
    newSocket.on('invalid-bingo', (data) => {
      toast.error(data.message);
    });
    
    newSocket.on('fee-deducted', (data) => {
      toast(data.message);
    });
    
    newSocket.on('game-update', (data) => {
      console.log('Game update received:', data);
      if (data.prizePool) {
        setPrizePool(data.prizePool);
        const winnerAmt = data.prizePool * 0.81;
        setWinnerAmount(winnerAmt);
      }
    });
    
    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [user, navigate, currentGameId, location.state]);

  useEffect(() => {
    if (showWinnerModal) {
      console.log('Winner modal shown, redirecting in 5 seconds...');
      const timer = setTimeout(() => {
        console.log('Redirecting to home...');
        navigate('/');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWinnerModal, navigate]);

  const handlePressBingo = () => {
    if (socket && socket.connected) {
      const gameIdToUse = currentGameId || location.state?.gameId;
      console.log('Pressing BINGO with gameId:', gameIdToUse);
      socket.emit('press-bingo', {
        userId: user.id,
        gameId: gameIdToUse
      });
      toast('BINGO! Checking your cards...');
    } else {
      toast.error('Connection lost. Please refresh the page.');
    }
  };

  const convertToGrid = (cartelaData) => {
    const grid = [];
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      rowData.push(cartelaData.B[row]);
      rowData.push(cartelaData.I[row]);
      rowData.push(cartelaData.N[row]);
      rowData.push(cartelaData.G[row]);
      rowData.push(cartelaData.O[row]);
      grid.push(rowData);
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
 const gameIdToUse = currentGameId || location.state?.gameId;
console.log('📤 Sending auto-mark with gameId:', gameIdToUse);
console.log('   currentGameId state:', currentGameId);
console.log('   location.state?.gameId:', location.state?.gameId);   
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
    
    const columns = {
      B: { numbers: [], range: [1, 15] },
      I: { numbers: [], range: [16, 30] },
      N: { numbers: [], range: [31, 45] },
      G: { numbers: [], range: [46, 60] },
      O: { numbers: [], range: [61, 75] }
    };
    
    for (let col in columns) {
      const [min, max] = columns[col].range;
      for (let i = min; i <= max; i++) {
        columns[col].numbers.push({
          number: i,
          called: calledMap.has(i),
          display: `${col}${i}`
        });
      }
    }
    
    return (
      <div className="bingo-board-full">
        <h3>🎯 Called Numbers Board</h3>
        <div className="bingo-columns">
          {Object.entries(columns).map(([letter, data]) => (
            <div key={letter} className="bingo-column-full">
              <div className="column-header">{letter}</div>
              <div className="column-numbers-full">
                {data.numbers.map((item) => (
                  <div
                    key={item.number}
                    className={`bingo-number ${item.called ? 'called' : ''}`}
                  >
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
        <div className="call-count">
          📞 Calls: {callCount}/75
        </div>
        <div className="prize-info">
          <div className="winner-prize-display">
            🏆 Winner Gets: {winnerAmount.toFixed(2)} Birr 
          </div>
        </div>
        <div className="game-controls">
		{/* <button
            className={`mode-toggle ${autoMark ? 'auto' : 'manual'}`}
            onClick={() => setAutoMark(!autoMark)}
          >
            {autoMark ? '🤖 Auto-Mark ON' : '✋ Manual-Mark OFF'}
          </button>
          <button className="bingo-button" onClick={handlePressBingo}>
            🎲 BINGO!
</button>*/}
		  <button onClick={() => {
  socket.emit('test-mark', { userId: user.id, number: 1 });
}}>
  TEST MARK NUMBER 1
</button>
<button 
  onClick={() => {
    console.log('🔍 CURRENT MARKED NUMBERS:', markedNumbers);
    console.log('Total marked:', markedNumbers.length);
    socket.emit('get-marked-numbers', { userId: user.id });
  }}
  style={{background: 'blue', color: 'white', padding: '10px', margin: '5px'}}
>
  🔍 SHOW MARKED NUMBERS
</button>
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
                <p>Please make sure you selected lucky numbers before the game started.</p>
                <button onClick={() => navigate('/')} className="back-button">
                  ← Back to Home
                </button>
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
          {gameActive ? (
            <span className="status-active">🔴 Game In Progress - Mark your numbers!</span>
          ) : (
            <span className="status-ended">🏁 Game Ended - Redirecting to home...</span>
          )}
        </div>
      </div>
<button 
  onClick={() => {
    console.log('🏆 FORCING WIN');
    socket.emit('force-win', { userId: user.id });
  }}
  style={{
    background: '#ff4444',
    color: 'white',
    padding: '15px',
    fontSize: '18px',
    margin: '10px',
    borderRadius: '10px'
  }}
>
  🏆 FORCE WIN (TEST)
🏆
</button>
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
              
              <div className="winner-redirect">
                Redirecting to home in 5 seconds...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
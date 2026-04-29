import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import axios from 'axios';
import './Home.css';
import { FaWallet, FaMoneyBillWave, FaHistory, FaDownload, FaTimes } from 'react-icons/fa';
const Home = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [luckyNumbers, setLuckyNumbers] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(35);
  const [winnerAmount, setWinnerAmount] = useState(0); // Changed from prizePool to winnerAmount
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [balance, setBalance] = useState(user?.wallet_balance || 0);
  const [showAdModal, setShowAdModal] = useState(true);
  const [adData, setAdData] = useState(null);
  const [showFooter, setShowFooter] = useState(false);
  const [takenNumbers, setTakenNumbers] = useState([]);

// Add this state with your other states
const [isGameActive, setIsGameActive] = useState(false);
const [waitingMessage, setWaitingMessage] = useState('');
// Add these state variables after your existing states
const [showBalanceModal, setShowBalanceModal] = useState(false);
const [showWithdrawModal, setShowWithdrawModal] = useState(false);
const [showDepositModal, setShowDepositModal] = useState(false);
const [showHistoryModal, setShowHistoryModal] = useState(false);
const [transactions, setTransactions] = useState([]);
const [gameHistory, setGameHistory] = useState([]);
const [withdrawAmount, setWithdrawAmount] = useState('');
const [withdrawPhone, setWithdrawPhone] = useState('');
const [depositAmount, setDepositAmount] = useState(null);
const [depositSms, setDepositSms] = useState('');
const [depositStatus, setDepositStatus] = useState('');
  // Fetch cartela data
  const fetchCartela = async (luckyNumber) => {
    try {
      const response = await axios.get(`https://bingo-game-production-dd0b.up.railway.app/api/cartela/${luckyNumber}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch cartela:', error);
      return null;
    }
  };

// Fetch transactions and game history
const fetchTransactions = async () => {
  try {
    const response = await axios.get(`https://bingo-game-production-dd0b.up.railway.app/api/user/transactions/${user.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    setTransactions(response.data);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
  }
};
const fetchGameHistory = async () => {
  try {
    console.log('Fetching game history for user:', user.id);
    const response = await axios.get(`https://bingo-game-production-dd0b.up.railway.app/api/user/game-history/${user.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log('Game history response:', response.data);
    setGameHistory(response.data);
  } catch (error) {
    console.error('Failed to fetch game history:', error);
  }
};

// Handle deposit request
// Handle deposit request
const handleDeposit = async () => {
  if (!depositAmount) {
    toast.error('Please select an amount');
    return;
  }
  if (!depositSms) {
    toast.error('Please paste the Telebirr SMS');
    return;
  }
  
  setDepositStatus('processing');
  try {
    const response = await axios.post('https://bingo-game-production-dd0b.up.railway.app/api/user/deposit-request', {
      userId: user.id,
      amount: depositAmount,
      smsText: depositSms
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (response.data.success) {
      toast.success(response.data.message);
      setShowDepositModal(false);
      setDepositAmount(null);
      setDepositSms('');
      // Refresh balance
      const balanceResponse = await axios.get(`https://bingo-game-production-dd0b.up.railway.app/api/user/balance/${user.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBalance(balanceResponse.data.balance);
      // Refresh user object
      setUser(prev => ({ ...prev, wallet_balance: balanceResponse.data.balance }));
    }
  } catch (error) {
    console.error('Deposit error:', error);
    const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to submit deposit request';
    toast.error(errorMsg);
  } finally {
    setDepositStatus('');
  }
};

// Handle withdraw request
const handleWithdraw = async () => {
  if (!withdrawAmount || withdrawAmount < 100) {
    toast.error('Minimum withdrawal amount is 100 Birr');
    return;
  }
  if (withdrawAmount > balance) {
    toast.error('Insufficient balance');
    return;
  }
  if (!withdrawPhone) {
    toast.error('Please enter your phone number');
    return;
  }
  
  try {
    const response = await axios.post('https://bingo-game-production-dd0b.up.railway.app/api/user/withdraw', {
      userId: user.id,
      amount: parseFloat(withdrawAmount),
      phoneNumber: withdrawPhone
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (response.data.success) {
      toast.success('Withdrawal request submitted! Admin will process within 24 hours.');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawPhone('');
    }
  } catch (error) {
    console.error('Withdraw error:', error);
    toast.error('Failed to submit withdrawal request');
  }
};


  // Convert cartela to grid for display
  const convertToGrid = (cartelaData) => {
    if (!cartelaData) return [];
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

  // Handle number click - Select or Deselect
  const handleNumberClick = async (number) => {
  if (gameStatus !== 'waiting') {
    toast.error('Game already started! Please wait for next game.');
    return;
  }
  
  if (selectedNumbers.includes(number)) {
    // DESELECT - This is YOUR selected number
    if (socket) {
      socket.emit('deselect-cartela', {
        luckyNumber: number,
        userId: user.id
      });
    }
     setSelectedNumbers(prev => prev.filter(n => n !== number));
    setSelectedCartelas(prev => {
      const newCartelas = prev.filter(c => c.lucky_number !== number);
      localStorage.setItem('userCartelas', JSON.stringify(newCartelas));
      return newCartelas;
    });
    toast(`Cartela ${number} deselected`);
  } else {
    // SELECT - This is a new number
    // Check if number is taken by another player
    if (takenNumbers.includes(number)) {
      toast.error('This lucky number is already taken by another player!');
      return;
    }
    
    if (selectedNumbers.length >= 2) {
      toast.error('Maximum 2 cartelas allowed per game!');
      return;
    }
    
    if (balance < (selectedNumbers.length + 1) * 10) {
      toast.error(`Insufficient balance! Need ${(selectedNumbers.length + 1) * 10} Birr for ${selectedNumbers.length + 1} cartela(s).`);
      return;
    }
    
    const cartelaData = await fetchCartela(number);
    if (cartelaData) {
      if (socket) {
        socket.emit('select-cartela', {
          luckyNumber: number,
          userId: user.id
        });
      }
      setSelectedNumbers(prev => [...prev, number]);
     
       const newCartela = {
        lucky_number: number,
        card_data: cartelaData.card_data
      };
      
      
      setSelectedCartelas(prev => {
        const newCartelas = [...prev, newCartela];
        localStorage.setItem('userCartelas', JSON.stringify(newCartelas));
        return newCartelas;
      });
    // toast.success(`Cartela ${number} selected!`);
    }
  }
};

  useEffect(() => {
    	   // Check if user is logged in
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  
  if (!token || !savedUser) {
    // Redirect to login if not logged in
    navigate('/login');
    return;
  }
    // Fetch advertisement
    fetchAdvertisement();
    
    // Initialize WebSocket
  //  const newSocket = io('https://bingo-game-production-dd0b.up.railway.app');
  const newSocket = io('https://bingo-game-production-dd0b.up.railway.app', {
  transports: ['websocket', 'polling']
 // withCredentials: false
});
    setSocket(newSocket);
    
    // Generate lucky numbers 1-100
    const numbers = Array.from({ length: 200 }, (_, i) => i + 1);
    setLuckyNumbers(numbers);
    
    // Register player
    if (user && user.id) {
      newSocket.emit('register-player', {
        userId: user.id,
        phoneNumber: user.phone_number
      });
    }
    
    // Socket event listeners
  // Update the registered event handler to receive taken numbers

    // Update the registered event handler to receive taken numbers
newSocket.on('registered', (data) => {
  console.log('Registered:', data);
  setBalance(data.user.wallet_balance);
  
  // Check if game is already ACTIVE
  if (data.gameStatus === 'active') {
    console.log('Game is already active - redirecting to watch as spectator');
    
    // Redirect to GameRoom as spectator immediately
    navigate(`/game/${user.id}`, { 
      state: { 
        gameId: data.gameId,
        gameNumber: data.gameNumber,
        prizePool: data.prizePool,
        winnerAmount: data.winnerAmount || 0,
        isSpectator: true,
        selectedCartelas: [] 
      } 
    });
    return;
  }
  
  // If game is WAITING (not active), show waiting UI
  console.log('Game is waiting - showing selection UI');
  setIsGameActive(false);
  setWaitingMessage('');
  
 if (data.totalPlayers === 0 && data.totalCartelas === 0) {
    console.log('Brand new game - resetting selections');
    setTakenNumbers([]);
    setSelectedNumbers([]);
    setSelectedCartelas([]);
    localStorage.removeItem('userCartelas');
  } else {
    // Keep existing selections, just update taken numbers
    console.log('Preserving existing selections');
    if (data.takenNumbers) {
      setTakenNumbers(data.takenNumbers);
    }
  }
  
  if (data.prizePool) {
    setWinnerAmount(data.winnerAmount || 0);
  }
});
    
   /* newSocket.on('game-state', (data) => {
      setGameStatus(data.status);
      // Calculate winner amount (81% of prize pool)
      //const winnerAmt = (data.prizePool || 0) * 0.81;
      setWinnerAmount(data.winnerAmount || 0);
	  console.log('Game state - Prize pool:', data.prizePool, 'Winner amount:', data.winnerAmount);
    });*/
	// Update game-state event handler
newSocket.on('game-state', (data) => {
  setGameStatus(data.status);
  setWinnerAmount(data.winnerAmount || 0);
  if (data.takenNumbers) {
    setTakenNumbers(data.takenNumbers);
  }
  console.log('Game state:', data);
});
    
    newSocket.on('game-waiting', (data) => {
      setGameStatus('waiting');
      setTimeRemaining(data.prepareTime);
      toast.success(data.message);
	  
	    // NEW CODE: Ensure lucky numbers are shown during waiting period
		 // setTakenNumbers([]);
  //setSelectedNumbers([]);
  //setSelectedCartelas([]);
  setWinnerAmount(0);  // ← ADD THIS
  setIsGameActive(false);
  setWaitingMessage('');
    // Also clear localStorage for new game
  //localStorage.removeItem('userCartelas');
    });
  // Listen for game-ended event (when a game ends) - ADD THIS
newSocket.on('game-ended', (data) => {
  console.log('Game ended - showing lucky numbers');
setTakenNumbers([]);
  setSelectedNumbers([]);
  setSelectedCartelas([]); 
 setIsGameActive(false);
  setWaitingMessage('');
   setWinnerAmount(0);  // Reset winner amount to 0
    localStorage.removeItem('userCartelas');
    newSocket.emit('get-game-state');
  toast.success('Game ended! You can now select lucky numbers for the next game.');
  
});  
  newSocket.on('game-update', (data) => {
  setTotalPlayers(data.totalPlayers);
 // const winnerAmt = (data.prizePool || 0) * 0.81;
  setWinnerAmount(data.winnerAmount || 0);
   console.log('Game update - Prize pool:', data);
});
    
    newSocket.on('cartela-selected-success', (data) => {
      console.log('Cartela selected success:', data);
	  toast.success(`Cartela ${data.luckyNumber} selected!`);
  setSelectedNumbers(prev => [...prev, data.luckyNumber]);
  // Request updated game state
  newSocket.emit('get-game-state');
    });
    
    newSocket.on('cartela-selected', (data) => {
      setTakenNumbers(prev => [...prev, data.luckyNumber]);
    //  toast(`Lucky number ${data.luckyNumber} has been taken!`);
    });
    
    newSocket.on('cartela-deselected', (data) => {
      setTakenNumbers(prev => prev.filter(n => n !== data.luckyNumber));
    });
    
    newSocket.on('countdown-update', (data) => {
      setTimeRemaining(data.timeRemaining);
    });
 newSocket.on('rejoin-game', (data) => {
  console.log('🔄 Rejoining active game!', data);
  toast('Rejoining your active game...');
  
  navigate(`/game/${user.id}`, { 
    state: { 
      gameId: data.gameId,
      gameNumber: data.gameNumber,
      prizePool: data.prizePool,
      winnerAmount: data.winnerAmount,
      isSpectator: false,
      selectedCartelas: data.selectedCartelas,
      markedNumbers: data.markedNumbers,  // ← Pass marked numbers
      rejoining: true
    } 
  });
});   
  // In your game-started event listener
/*
newSocket.on('game-started', (data) => {
  console.log('Game started! Prize pool:', data.prizePool);
  console.log('Selected cartelas before navigate:', selectedCartelas);
    // NEW CODE: Hide lucky numbers on home page
  setIsGameActive(true);
  setWaitingMessage('🎮 Another game is in progress. Please wait for the next game...');
  // Calculate winner amount from prize pool
  const winnerAmt = (data.prizePool || 0) * 0.81;
  
  // Make sure cartelas are saved to localStorage before navigating
  if (selectedCartelas.length > 0) {
    localStorage.setItem('userCartelas', JSON.stringify(selectedCartelas));
  }
  
  toast.success(data.message);
  
  navigate(`/game/${user.id}`, { 
    state: { 
      gameId: data.gameId,
      gameNumber: data.gameNumber,
      prizePool: data.prizePool,
      winnerAmount: winnerAmt,
      selectedCartelas: selectedCartelas 
    } 
  });
});
*/
 newSocket.on('game-started', (data) => {
  console.log('Game started! Prize pool:', data.prizePool);
  console.log('localStorage userCartelas:', localStorage.getItem('userCartelas'));
  // IMPORTANT: Read from localStorage instead of state
  const savedCartelas = localStorage.getItem('userCartelas');
  let hasSelectedCartelas = false;
  let cartelasToSend = [];
  
  if (savedCartelas) {
    cartelasToSend = JSON.parse(savedCartelas);
    hasSelectedCartelas = cartelasToSend.length > 0;
    console.log('Found cartelas in localStorage:', cartelasToSend.length);
  } else {
    console.log('No cartelas found in localStorage');
  }
  
  console.log('hasSelectedCartelas:', hasSelectedCartelas);
  
  if (hasSelectedCartelas) {
    console.log('User is a PLAYER, joining the game');
    setIsGameActive(true);
    setWaitingMessage('🎮 Game started! You are playing...');
    
    const winnerAmt = (data.prizePool || 0) * 0.81;
    
    navigate(`/game/${user.id}`, { 
      state: { 
        gameId: data.gameId,
        gameNumber: data.gameNumber,
        prizePool: data.prizePool,
        winnerAmount: winnerAmt,
        isSpectator: false,
        selectedCartelas: cartelasToSend 
      } 
    });
  } else {
    console.log('User is a SPECTATOR, watching live game');
    setIsGameActive(true);
    setWaitingMessage('🎮 Watching live game...');
    
    const winnerAmt = (data.prizePool || 0) * 0.81;
    
    navigate(`/game/${user.id}`, { 
      state: { 
        gameId: data.gameId,
        gameNumber: data.gameNumber,
        prizePool: data.prizePool,
        winnerAmount: winnerAmt,
        isSpectator: true,
        selectedCartelas: [] 
      } 
    });
  }
  
  toast.success(data.message);
});   
    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  const fetchAdvertisement = async () => {
    try {
      const response = await axios.get('https://bingo-game-production-dd0b.up.railway.app/api/admin/advertisement');
      setAdData(response.data);
    } catch (error) {
      console.error('Failed to fetch ad:', error);
	  setAdData(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userCartelas');
    navigate('/login');
  };

 const isNumberDisabled = (number) => {
  // Only disable if game is not waiting OR number is taken by another player
  if (gameStatus !== 'waiting') return true;
  if (takenNumbers.includes(number) && !selectedNumbers.includes(number)) return true;
  return false;
};

  // Render a single cartela (for display below lucky numbers)
  const renderCartela = (cartela, index) => {
    const grid = convertToGrid(cartela.card_data);
    
    return (
      <div key={index} className="selected-cartela">
        <div className="cartela-header">
          <h4>Cartela #{cartela.lucky_number}</h4>
          <button 
            className="remove-cartela-btn"
            onClick={() => handleNumberClick(cartela.lucky_number)}
          >
            ✕ Remove
          </button>
        </div>
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
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className={cell === 'FREE' ? 'free-space' : ''}>
                    {cell === 'FREE' ? '⭐' : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="home-container">
      {/* Advertisement Modal */}
      {showAdModal && adData && adData.message && (
        <div className="modal-overlay">
          <div className="ad-modal">
            <button className="close-btn" onClick={() => setShowAdModal(false)}>✕</button>
            {adData.image_url && <img src={adData.image_url} alt="Advertisement" />}
            <p>{adData.message}</p>
          </div>
        </div>
      )}
      
      {/* Header */}
	  <div className="header1">
	  <div className="user-info1">
          <h1>BINGO-B</h1>
          
        </div>
	  </div>
      <div className="header">
        <div className="user-info">
          <h3>👤 {user?.username || user?.phone_number}</h3>
          <p>💰 Balance: {balance} Birr</p>
        </div>
        <div className="game-info">
          <div className="winner-prize">🏆 ደራሽ : {Math.max(0, winnerAmount).toFixed(2)} Birr</div>
          <div className="timer">⏰ ቀጣይ ጨዋታ በ : {timeRemaining}s ይጀምራል </div>
			  {/* <div className="players">👥 Players: {totalPlayers}</div>*/}
        </div>
        {/*<button className="logout-btn" onClick={handleLogout}>Logout</button>*/}
      </div>
      
      {/* Lucky Numbers Grid */}
      <div className="lucky-numbers-section">
        <div className="lucky-numbers-grid">
          <h2>የእድል ቁጥር ይምረጡ </h2>
          
		  {/* Show waiting message when game is active */}
    {isGameActive && (
      <div className="game-active-warning">
        <div className="warning-icon">🎮</div>
        <div className="warning-message">{waitingMessage}</div>
        <div className="warning-submessage">The game will end soon. Please wait...</div>
      </div>
    )}
		  
		   {/* Show numbers only when game is NOT active */}
    {!isGameActive ? (
		  <div className="numbers-container">
            {luckyNumbers.map(number => (
              <button
                key={number}
                className={`lucky-number 
                  ${selectedNumbers.includes(number) ? 'selected' : ''} 
                  ${takenNumbers.includes(number) && !selectedNumbers.includes(number) ? 'taken' : ''}
                `}
                onClick={() => handleNumberClick(number)}
                disabled={isNumberDisabled(number)}
              >
                {number}
			{selectedNumbers.includes(number) && ' ✓'}
{takenNumbers.includes(number) && !selectedNumbers.includes(number) && ' 🔒'}
              </button>
            ))}
          </div>
		  ):(
		  <div className="numbers-disabled-overlay">
        <div className="loading-spinner-small"></div>
        <p>Waiting for current game to finish...</p>
      </div>
    )}
        </div>
        
 {/* Selected Cartelas Display - also hide during active game */}
        {!isGameActive && selectedCartelas.length > 0 && (
          <div className="selected-cartelas-section">
            <h3>Your Selected Cartelas ({selectedCartelas.length}/2)</h3>
            <div className="cartelas-container">
              {selectedCartelas.map((cartela, index) => renderCartela(cartela, index))}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
   <div className="purple-footer">
      <button className="footer-icon-btn" onClick={() => {
        fetchTransactions();
        setShowBalanceModal(true);
      }}>
        <FaWallet className="footer-icon" />
        <span className="footer-label">Balance</span>
      </button>
      
   <button className="footer-icon-btn" onClick={() => {
  setWithdrawAmount('');
  setWithdrawPhone('');
  setShowWithdrawModal(true);
}}>
        <FaDownload className="footer-icon" />
        <span className="footer-label">Withdraw</span>
      </button>
      
    <button className="footer-icon-btn" onClick={() => {
  setDepositAmount(null);
  setDepositSms('');
  setShowDepositModal(true);
}}>
        <FaMoneyBillWave className="footer-icon" />
        <span className="footer-label">Deposit</span>
      </button>
      
      <button className="footer-icon-btn" onClick={() => {
        fetchGameHistory();
        setShowHistoryModal(true);
      }}>
        <FaHistory className="footer-icon" />
        <span className="footer-label">History</span>
      </button>
    </div>
    
    {/* BALANCE MODAL */}
{showBalanceModal && (
  <div className="modal-overlay" onClick={() => setShowBalanceModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>💰 Balance & Transactions</h2>
        <button className="modal-close-x" onClick={() => setShowBalanceModal(false)}>✕</button>
      </div>
      <div className="modal-body">
        <div className="current-balance">
          <h3>Current Balance</h3>
          <p className="balance-amount">{balance} Birr</p>
        </div>
        
        {/* Recent Winnings Section */}
        <div className="recent-winnings">
          <h3>🏆 Recent Winnings</h3>
          {transactions.filter(tx => tx.type === 'prize').length === 0 ? (
            <p className="no-data">No winnings yet</p>
          ) : (
            <div className="winnings-list">
              {transactions.filter(tx => tx.type === 'prize').slice(0, 5).map((win, idx) => (
                <div key={idx} className="winning-item">
                  <span>🎉 +{win.amount} Birr</span>
                  <span className="winning-date">{new Date(win.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="transactions-list">
          <h3>Transaction History</h3>
          {transactions.length === 0 ? (
            <p className="no-data">No transactions yet</p>
          ) : (
            <div className="transactions-table">
              <table>
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {transactions.map((tx, idx) => (
                    <tr key={idx}>
                      <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td className={`tx-type-${tx.type}`}>{tx.type}</td>
                      <td className={tx.amount >= 0 ? 'positive' : 'negative'}>{tx.amount >= 0 ? '+' : ''}{tx.amount} Birr</td>
                      <td>{tx.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
  {/* WITHDRAW MODAL */}
{showWithdrawModal && (
  <div className="modal-overlay" onClick={() => {
    setShowWithdrawModal(false);
    setWithdrawAmount('');
    setWithdrawPhone('');
  }}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>💸 Withdraw Request</h2>
        <button className="modal-close-x" onClick={() => {
          setShowWithdrawModal(false);
          setWithdrawAmount('');
          setWithdrawPhone('');
        }}>✕</button>
      </div>
	  
	  
      <div className="modal-body">
        <div className="current-balance">
          <p>Available Balance: <strong>{balance} Birr</strong></p>
          <p className="min-withdraw">Minimum withdrawal: 100 Birr</p>
        </div>
        <div className="input-group">
          <label>Amount (Birr)</label>
          <input 
            type="number" 
            placeholder="Enter amount" 
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            min="100"
            max={balance}
          />
        </div>
        <div className="input-group">
          <label>Phone Number (Telebirr)</label>
          <input 
            type="tel" 
            placeholder="2519xxxxxxxx" 
            value={withdrawPhone}
            onChange={(e) => setWithdrawPhone(e.target.value)}
          />
        </div>
        <button className="submit-btn" onClick={handleWithdraw}>
          Request Withdrawal
        </button>
      </div>
      <button className="modal-close-btn" onClick={() => {
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setWithdrawPhone('');
      }}>Close</button>
    </div>
  </div>
)}
    
    {/* DEPOSIT MODAL */}
    {/* DEPOSIT MODAL */}
{showDepositModal && (
  <div className="modal-overlay" onClick={() => {
    setShowDepositModal(false);
    setDepositAmount(null);
    setDepositSms('');
  }}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>📱 Deposit Money</h2>
        <button className="modal-close-x" onClick={() => {
          setShowDepositModal(false);
          setDepositAmount(null);
          setDepositSms('');
        }}>✕</button>
      </div>
	  
	  
	  
      <div className="modal-body">
        <div className="deposit-amounts">
          <p>Select Amount:</p>
          <div className="amount-buttons">
		   <button className={depositAmount === 20 ? 'active' : ''} onClick={() => setDepositAmount(20)}>20 Birr</button>
            <button className={depositAmount === 50 ? 'active' : ''} onClick={() => setDepositAmount(50)}>50 Birr</button>
            <button className={depositAmount === 100 ? 'active' : ''} onClick={() => setDepositAmount(100)}>100 Birr</button>
            <button className={depositAmount === 150 ? 'active' : ''} onClick={() => setDepositAmount(150)}>150 Birr</button>
				{/* <button className={depositAmount === 200 ? 'active' : ''} onClick={() => setDepositAmount(200)}>200 Birr</button>*/}
          </div>
        </div>
        <div className="telebirr-info-modal">
          <p>📱 Send money to Telebirr: <strong>09XX-XXX-XXX</strong></p>
          <p>After sending, copy the SMS confirmation and paste below:</p>
        </div>
        <div className="input-group">
          <label>Paste Telebirr SMS</label>
       <textarea 
  rows="4"
  placeholder="Paste the SMS you received from Telebirr here...&#10;&#10;Example:&#10;Dear Customer, ETB 100.00 sent to Tinsae Mulugeta (Business) successfully. Your transaction number is ABC123XYZ. Thank you for using Telebirr!"
  value={depositSms}
  onChange={(e) => setDepositSms(e.target.value)}
/>
        </div>
        <button className="submit-btn" onClick={handleDeposit} disabled={depositStatus === 'processing'}>
          {depositStatus === 'processing' ? 'Submitting...' : 'Submit Deposit Request'}
        </button>
      </div>
      <button className="modal-close-btn" onClick={() => {
        setShowDepositModal(false);
        setDepositAmount(null);
        setDepositSms('');
      }}>Close</button>
    </div>
  </div>
)}
    
    {/* HISTORY MODAL */}
  {showHistoryModal && (
  <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
    <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>📜 Game History</h2>
        <button className="modal-close-x" onClick={() => setShowHistoryModal(false)}>✕</button>
      </div>
         

		 <div className="modal-body">
            {gameHistory.length === 0 ? (
              <p className="no-data">No games played yet</p>
            ) : (
              <div className="history-table">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Game #</th><th>Cartelas</th><th>Status</th><th>Prize</th></tr>
                  </thead>
                  <tbody>
                    {gameHistory.map((game, idx) => (
                      <tr key={idx}>
                        <td>{new Date(game.joined_at).toLocaleDateString()}</td>
                        <td>#{game.Game?.game_number || 'N/A'}</td>
                        <td>{game.cartela_ids?.length || 0}</td>
                        <td className={game.is_winner ? 'winner-status' : 'loss-status'}>
                          {game.is_winner ? '🏆 WON' : '❌ Lost'}
                        </td>
                        <td className={game.is_winner ? 'winner-amount' : ''}>
                          {game.is_winner ? `${game.prize_amount} Birr` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <button className="modal-close-btn" onClick={() => setShowHistoryModal(false)}>Close</button>
        </div>
      </div>
    )}
      
      {/* Telebirr Number Display */}
      <div className="telebirr-info">
        <p>📱 Send deposit to: 09XX-XXX-XXX (Telebirr)</p>
        <p>Copy SMS and send to admin after payment</p>
      </div>
    </div>
  );
};

export default Home;
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'game-data.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function readGameData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取数据文件失败:', e);
  }
  return { highScores: [], games: [] };
}

function writeGameData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('写入数据文件失败:', e);
  }
}

app.get('/api/highscores', (req, res) => {
  const data = readGameData();
  res.json(data.highScores.slice(0, 10));
});

app.post('/api/highscores', (req, res) => {
  const { playerName, score, planetsVisited, fuelUsed } = req.body;
  
  const data = readGameData();
  const newScore = {
    id: Date.now(),
    playerName,
    score,
    planetsVisited,
    fuelUsed,
    date: new Date().toISOString()
  };
  
  data.highScores.push(newScore);
  data.highScores.sort((a, b) => b.score - a.score);
  writeGameData(data);
  
  res.json({ success: true, rank: data.highScores.indexOf(newScore) + 1 });
});

app.post('/api/games', (req, res) => {
  const gameData = req.body;
  const data = readGameData();
  
  const newGame = {
    id: Date.now(),
    ...gameData,
    date: new Date().toISOString()
  };
  
  data.games.push(newGame);
  writeGameData(data);
  
  res.json({ success: true, gameId: newGame.id });
});

app.listen(PORT, () => {
  console.log(`太阳系探索者服务器运行在 http://localhost:${PORT}`);
});

"use strict";
const words = [
	["每天", "每一天"],
	["自己", "自己的自己"],
	["長大", "長大的長大"],
	["已經", "已經完成的已經"],
	["年級", "班級的年級"],
	["上學", "上學的上學"],
	["小學生", "小學生的小學生"],
	["學校", "學校的學校"],
	["裹", "包裹的裹"],
	["老師", "老師的老師"],
	["有", "有沒有的有"],
	["同學", "同學的同學"],
	["快樂", "快樂的快樂"],
	["真", "真的真"],
];
const roads = ["", "dirt", "ice", "neon", "grass"],
	cars = ["#ef4054", "#287ed0", "#7c55c7", "#f19a24", "#28a568"];
const $ = (id) => document.getElementById(id),
	cards = [...document.querySelectorAll(".word")],
	positions = ["29%", "50%", "71%"];
let score = 0,
	coins = 0,
	lives = 10,
	level = 1,
	combo = 0,
	best = readBest(),
	lane = 1,
	target = null,
	locked = false,
	carColor = 0,
	roadIndex = 0,
	wordSpeed = 1.15,
	collisionArmed = true,
	motionOn = false,
	lastTilt = 0,
	audioCtx = null,
	engineGain = null,
	boost = 0,
	stars = 0;

function readBest() {
	try {
		return Number(localStorage.getItem("bestCombo")) || 0;
	} catch (e) {
		return 0;
	}
}
function saveBest() {
	try {
		localStorage.setItem("bestCombo", String(best));
	} catch (e) {}
}
function pick(a) {
	return a[Math.floor(Math.random() * a.length)];
}
function updateUI() {
	$("score").textContent = score;
	$("coins").textContent = coins;
	$("lives").textContent = lives;
	$("level").textContent = level;
	$("combo").textContent = combo;
	$("best").textContent = best;
	$("speedFill").style.width = Math.min(100, Math.round((wordSpeed + boost) * 32)) + "%";
}
function initAudio() {
	if (audioCtx) return;
	try {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		const master = audioCtx.createGain();
		master.gain.value = 0.8;
		master.connect(audioCtx.destination);
		engineGain = audioCtx.createGain();
		engineGain.gain.value = 0.006;
		engineGain.connect(master);
		const osc = audioCtx.createOscillator();
		osc.type = "sine";
		osc.frequency.value = 72;
		osc.connect(engineGain);
		osc.start();
	} catch (e) {
		audioCtx = null;
	}
}
function tone(freq, duration, type = "sine", volume = 0.055, slide = 0) {
	if (!audioCtx) return;
	const o = audioCtx.createOscillator(),
		g = audioCtx.createGain(),
		now = audioCtx.currentTime;
	o.type = type;
	o.frequency.setValueAtTime(freq, now);
	if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
	g.gain.setValueAtTime(0.0001, now);
	g.gain.exponentialRampToValueAtTime(volume, now + 0.015);
	g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
	o.connect(g);
	g.connect(audioCtx.destination);
	o.start(now);
	o.stop(now + duration + 0.03);
}
function soundCorrect() {
	tone(520, 0.11, "sine", 0.06, 170);
	setTimeout(() => tone(820, 0.18, "sine", 0.065, 220), 90);
}
function soundWrong() {
	tone(180, 0.18, "triangle", 0.045, -80);
}
function soundBoost() {
	tone(300, 0.1, "sine", 0.05, 500);
	setTimeout(() => tone(700, 0.11, "sine", 0.045, 300), 80);
}
function soundMove() {
	tone(240, 0.04, "triangle", 0.018, 30);
}
function speak(text, times = 1) {
	initAudio();
	if (!("speechSynthesis" in window)) return;
	speechSynthesis.cancel();
	let n = 0;
	const once = () => {
		if (n++ >= times) return;
		const u = new SpeechSynthesisUtterance(text);
		u.lang = "zh-HK";
		u.rate = 0.78;
		u.pitch = 1.25;
		u.volume = 1;
		u.onend = () => {
			if (n < times) setTimeout(once, 130);
		};
		speechSynthesis.speak(u);
	};
	once();
}
function introduction() {
	const text =
		"歡迎來到小小郵差中文字車手！你是一位郵差，要把正確的中文字信件送到學校。請用左右按鈕，或左右傾斜裝置控制郵車；按向上按鈕，或向上傾斜可以加速。撞上正確字卡，就能收集一顆星星。準備好了嗎？";
	$("modalTitle").textContent = "📮 郵差任務";
	$("result").textContent = text;
	$("close").textContent = "開始送信";
	$("modal").classList.add("show");
	speak(text);
}
function setRoad(force = false) {
	if (!force && Math.random() > 0.3) return;
	roadIndex = (roadIndex + 1) % roads.length;
	applyRoad();
}
function applyRoad() {
	const r = $("road");
	r.className = "road " + roads[roadIndex];
	wordSpeed = [1.05, 1.35, 0.8, 1.7, 1.15][roadIndex] + Math.min(level * 0.035, 0.65);
	r.style.setProperty("--road-speed", `${Math.max(0.55, 1.5 - wordSpeed / 2)}s`);
}
function setWords() {
	const rest = words.filter((w) => w[0] !== target[0]);
	const opts = [target, pick(rest), pick(rest)].sort(() => Math.random() - 0.5);
	cards.forEach((c, i) => {
		c.textContent = opts[i][0];
		c.dataset.char = opts[i][0];
		c.style.left = positions[i];
		c.style.top = -80 - i * 105 + "px";
		c.classList.remove("hint", "correct", "wrong");
		c.dataset.hit = "false";
	});
}
function setup() {
	locked = false;
	collisionArmed = true;
	lane = 1;
	boost = 0;
	$("car").classList.remove("fast");
	$("car").style.left = positions[lane];
	target = pick(words);
	$("question").textContent = `郵差任務：把「${target[0]}」信件送到學校！`;
	setWords();
	setRoad();
	updateUI();
	speak(`找出：${target[0]}`);
}
function move(d) {
	if (locked) return;
	lane = Math.max(0, Math.min(2, lane + d));
	$("car").style.left = positions[lane];
	soundMove();
}
function accelerate() {
	if (locked) return;
	initAudio();
	boost = Math.min(1.8, boost + 0.35);
	$("car").classList.add("fast");
	soundBoost();
	clearTimeout(accelerate.timer);
	accelerate.timer = setTimeout(() => {
		boost = Math.max(0, boost - 0.25);
		if (boost <= 0.05) {
			boost = 0;
			$("car").classList.remove("fast");
		}
	}, 600);
	updateUI();
}
function flash(t) {
	const f = $("flash");
	f.textContent = t;
	f.classList.remove("show");
	void f.offsetWidth;
	f.classList.add("show");
}
function hit(a, b) {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function addStar() {
	stars++;
	const s = document.createElement("span");
	s.className = "star new";
	s.textContent = "⭐";
	$("starRack").appendChild(s);
	setTimeout(() => s.classList.remove("new"), 900);
}
function collide() {
	if (locked || !collisionArmed) return;
	const cr = $("car").getBoundingClientRect();
	let selected = null;
	cards.some((c) => {
		if (c.dataset.hit !== "true" && hit(cr, c.getBoundingClientRect())) {
			selected = c;
			return true;
		}
		return false;
	});
	if (!selected) return;
	selected.dataset.hit = "true";
	collisionArmed = false;
	if (selected.dataset.char === target[0]) correct(selected);
	else wrong(selected);
}
function correct(c) {
	locked = true;
	c.classList.add("correct");
	combo++;
	best = Math.max(best, combo);
	saveBest();
	score += 10 * level + combo * 2;
	coins++;
	addStar();
	flash("送信成功！⭐");
	soundCorrect();
	speak(`${target[0]}`);
	updateUI();
	setTimeout(() => {
		if (level % 5 === 0) mission();
		else {
			level++;
			setup();
		}
	}, 850);
}
function wrong(c) {
	c.classList.add("wrong", "hint");
	flash("信件不對！");
	soundWrong();
	speak(c.dataset.char, 2);
	setTimeout(() => {
		c.classList.remove("wrong", "hint");
		if (lives <= 1) {
			lives = 0;
			combo = 0;
			updateUI();
			end();
		} else {
			lives--;
			combo = 0;
			collisionArmed = true;
			updateUI();
		}
	}, 700);
}
function mission() {
	locked = true;
	tone(660, 0.12);
	setTimeout(() => tone(880, 0.12), 130);
	setTimeout(() => tone(1100, 0.2), 260);
	$("modalTitle").textContent = "🏫 送信成功！";
	$("result").textContent = `你已完成第 ${level} 關！郵車收集了 ${stars} 顆星星，得到 ${score} 分。`;
	$("close").textContent = "繼續送信";
	$("modal").classList.add("show");
	speak("送信成功！恭喜你！");
}
function end() {
	locked = true;
	soundWrong();
	$("modalTitle").textContent = "🏁 郵車休息時間";
	$("result").textContent = `今天完成 ${score} 分，收集 ${stars} 顆星星。`;
	$("close").textContent = "再玩一次";
	$("modal").classList.add("show");
	speak("遊戲結束，謝謝你完成送信任務！");
}
function reset() {
	initAudio();
	score = 0;
	coins = 0;
	lives = 10;
	level = 1;
	combo = 0;
	stars = 0;
	$("starRack").innerHTML = "";
	roadIndex = 0;
	applyRoad();
	$("menu").classList.remove("show");
	setup();
}
function closeModal() {
	const intro = $("modalTitle").textContent === "📮 郵差任務",
		over = lives === 0;
	$("modal").classList.remove("show");
	if (intro) setup();
	else if (over) reset();
	else {
		level++;
		setup();
	}
}
function changeCar() {
	initAudio();
	carColor = (carColor + 1) % cars.length;
	document.querySelector(".body").style.background = cars[carColor];
	tone(440, 0.08);
}
function changeRoad() {
	initAudio();
	roadIndex = (roadIndex + 1) % roads.length;
	applyRoad();
	tone(330, 0.08);
}
function moveWords() {
	if (!locked) {
		const speed = wordSpeed + boost;
		cards.forEach((c, i) => {
			let y = parseFloat(c.style.top) || -80;
			y += speed;
			if (y > 760) {
				y = -90 - i * 100;
				c.style.left = positions[Math.floor(Math.random() * 3)];
				c.dataset.hit = "false";
			}
			c.style.top = y + "px";
		});
		collide();
	}
	requestAnimationFrame(moveWords);
}
async function enableMotion() {
	initAudio();
	if (motionOn) return;
	if (
		typeof DeviceOrientationEvent !== "undefined" &&
		typeof DeviceOrientationEvent.requestPermission === "function"
	) {
		try {
			const p = await DeviceOrientationEvent.requestPermission();
			if (p !== "granted") throw new Error();
		} catch (e) {
			$("motionStatus").textContent = "Motion Control：需要允許感應器";
			return;
		}
	}
	window.addEventListener("deviceorientation", onTilt);
	motionOn = true;
	$("motionStatus").textContent = "Motion Control：已啟用";
}
function onTilt(e) {
	if (locked) return;
	const x = Number(e.gamma) || 0,
		y = Number(e.beta) || 0;
	if (Math.abs(x - lastTilt) > 5) {
		if (x > 12) move(1);
		else if (x < -12) move(-1);
		lastTilt = x;
	}
	if (y < -8) accelerate();
}

$("left").onclick = () => {
	initAudio();
	move(-1);
};
$("right").onclick = () => {
	initAudio();
	move(1);
};
$("boost").onclick = accelerate;
$("roadBtn").onclick = changeRoad;
$("garage").onclick = changeCar;
$("restartMenu").onclick = reset;
$("close").onclick = closeModal;
$("levelButton").onclick = () => {
	$("menu").classList.toggle("show");
	enableMotion();
};

document.addEventListener("keydown", (e) => {
	if (e.key === "ArrowLeft") {
		e.preventDefault();
		initAudio();
		move(-1);
	}
	if (e.key === "ArrowRight") {
		e.preventDefault();
		initAudio();
		move(1);
	}
	if (e.key === "ArrowUp") {
		e.preventDefault();
		accelerate();
	}
	if (e.key === "Enter" && $("modal").classList.contains("show")) closeModal();
});
document.addEventListener(
	"pointerdown",
	() => {
		initAudio();
		enableMotion();
	},
	{ once: true }
);
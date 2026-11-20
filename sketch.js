// GLOBALA VARIABLER (globala variabler = alla funktioner kan se och ändra i)

// KOPPLING TILL LAMPOR
let ws = new WebSocket('ws://10.0.0.100:8080');
let L = (n, v) => ws.readyState == 1 && ws.send(JSON.stringify({ type: 'take', lights: [n], values: v }));



// variabel för ml5 modellen som styr bodytracking
let bodyPose;

// poses = alla kroppar som modellen hittar just nu (rådata från ml5)
// people = de max två personer vi väljer ut, med plats 1 (vänster) eller 2 (höger)
// poses är rådatan från modellen inklusive personer i bakgrunden etc.
// dessa arrays fylls i gotPoses där resultatet från ml5-modellen läggs i variablerna
let poses = [];
// people är en städad verision av poses som innehåller max två personer och delar deras platser i plats 1(väster) plats 2 (höger)
let people = [];

// variabel för kamerabilden som ritas upp
let video;

// RÖRELSE PER PLATS (1 = vänster, 2 = höger)
// prickarnas positioner förra gången, per plats 1 och 2 utifrån nyckel, dvs 1 är vänster och 2 är höger
let prevBySlot = {};
// variabel som innehåller den utjämnade rörelse "lerp" rörelsen för plats 1 och plats 2.
let movementBySlot = {};
// För varje punkt på kroppen räknas det ut hur många pixlar den har flyttat sig sedan förra gången modellen analyserade bilden. Sedan tas medelvärdet av alla punkter. Om alla punkter i snitt har flyttat sig 3 pixlar mellan två analyser blir värdet 3. Altså 3 pixlar per analys och inte sekund.
// gränsen för "för mycket"
let threshold = 3;


// VARIABLER MUSIK
// Dockans sång
let song;
// Theme song som körs innan start
let theme;
// Variabel för vilket läge som spelet är i (waiting, playing eller silent)
let state = "waiting";


// LJUDEFFEKTER FÖR ELIMINERING
// Variabler för de olika ljudeffekterna
let player1Sound;
let player2Sound;
let allPlayersSound;
let gameOverSound;
// blir true när båda elimineras 
let gameOverPlaying = false;
// blir true när vinstlåden spelas
let winnerPlaying = false;


// VARIABLER FÖR FÖRDRÖJNING
// tidpunkten (millis) när musiken stoppade
let silentSince = 0;
// fördjörningstid i millisekunder (alltså 1 sekund) innan eliminering kan triggas, för att man inte ska åka ut direkt
let graceTime = 1000;


// VARIABLER FÖR START AV SPEL
// variabel för att starta musiken. Blir true när man klickat en gång
let audioReady = false;
// När båda spelarna börjar göra startposen
let poseStart = 0;
// Posen ska hållas i 1,5 sekunder för att starta spelet.
let holdTime = 1500;


// VARIBALER FÖR ELIMINERING
// håller koll på vilka spelare som är ute. Än så länge false 
let eliminated = { 1: false, 2: false };
// meddelande som ska visas på skärmen
let message = "";
// variabel för hur länge meddelandet ska visas
let messageUntil = 0;
// ska visas i 3 sekunder
let messageTime = 3000;
// håller koll på timern som startar nästa musikomgång
let nextSongTimer;

// Variabel för bild på spargrisen
let pig;

let hueLights;
let satLights;

// LADDA MODELLEN
function modelReady() {
  console.log("Modellerna är laddade!");
}


// SETUP START
async function setup() {
  createCanvas(640, 480);

  // await betyder vänta tills modellen har laddat klart innan koden går vidare
  // MULTIPOSE_LIGHTNING hittar flera personer (annars hittas bara en), en variant av modellen MoveNet
  bodyPose = await ml5.bodyPose("MoveNet", {
    modelType: "MULTIPOSE_LIGHTNING"
  });
  // funktion som körs när modellen har laddat klart
  modelReady();

  // ritar upp video
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // börjar analysera videon kontinuerligt
  bodyPose.detectStart(video, gotPoses);


  // FONT
  squidGameFont = await loadFont('squidGameFont.ttf');
  breadFont = await loadFont('breadFont.ttf');

  // BILDER
  dockaFram = await loadImage('dockaFram.png');
  dockaBak = await loadImage('dockaBak.png');
  pig = await loadImage('pig.png');


  // MUSIK
  // temalåten innan spelet startats
  theme = createAudio("theme(mp3.pm).mp3");
  theme.hide();
  // loopas
  theme.elt.loop = true;

  // Dockans låt (createAudio används för att låten inte ska ändra pitch när den snabbspolas)
  song = createAudio("song.mp3");
  song.hide();
  // Behåller pitch även när snabbspolat
  song.elt.preservesPitch = true;
  song.elt.webkitPreservesPitch = true;

  // VINSTSÅNG
  winnerSound = createAudio("winnerSound.m4a");
  winnerSound.hide();
  // när vinstljudet är klart startas funktionen endSongFinished som gör att spelet startas om och temalåten spelas igen
  winnerSound.onended(endSongFinished);


  // LJUDEFFEKTER ELIMINERING
  // lägger in varje ljud i dess variabel och döljer spelaren
  player1Sound = createAudio("Player1eliminated.mp3");
  player1Sound.hide();
  player2Sound = createAudio("Player2eliminated.mp3");
  player2Sound.hide();
  allPlayersSound = createAudio("Allplayerseliminated.mp3");
  allPlayersSound.hide();
  gameOverSound = createAudio("Gameover.mp3");
  gameOverSound.hide();

  // när "alla eliminerade" har spelats så ska game over spelas precis efter, funktionen playGameOver aktiveras
  allPlayersSound.onended(playGameOver);
  // när Gameover har spelats klart så ska funktionen endSongFinished aktiveras, som gör att spelet startas om och temalåten spelas igen
  gameOverSound.onended(endSongFinished);
}
// SETUP SLUT



// DRAW START
function draw() {

  // om kameran inte har startat än, rita inget
  if (!video) return;

  // flippa videon så att det blir som en spegel. Push och pop avskiljer så att annan kod inte ritas upp spegelvänt.
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  // Filter med gråskala
  filter(GRAY);

  // För att göra det ännu mörkare så lägger vi på en rektangel med samma storlek som skärmen och gör svart med lite transparens
  // 170 av 255 i transparens
  fill(0, 170);
  noStroke();
  rect(0, 0, width, height);


  // START A SPELET OCH START MED EN POSE (START)
  // Om state är waiting (vilket det är som standard, bestämt i variblerna ovan) så ska text visas och temalåten spelas samt vita lampor aktiveras. 
  // visa bara startskärmen om vinstljudet inte spelas samtidigt. När winnerSound är klart sätts winnerPlaying till false i endSongFinished() och startskärmen kommer tillbaka
  if (state === "waiting" && !winnerPlaying && !gameOverPlaying) {
    fill(255);
    textSize(20);
    textAlign(CENTER);
    eliminated = { 1: false, 2: false };

    // VITA LAMPOR
    hueLights = 0;
    satLights = 0;
    lamps();


    // Se vem som är nrmast kameran för att kunna avgöra vinnare
    let nearest = closest();
    // console.log("Närmast kameran:", nearest);


    // Om audioReady är false (vilket det är satt som i variablerna ovan) så ska instruktioner att klicka visas. Annars (om man har klickat) så ska instruktionen att starta spelet visas.
    // Det här är mest till för oss, eftersom det endast görs en gång för att få igång ljudet
    if (!audioReady) {
      text("Klicka en gång på sidan för att aktivera ljudet", width / 2, height / 3);
    }
    // Annars, om aduioReady alltså är true, så ska instruktionerna visas
    else {
      push();
      textFont(squidGameFont)
      textSize(height / 7);
      fill(237, 27, 118);
      // Vi använder width och height istället för pixlar eftersom vi inte vet skärmstorleken på TVn
      text("red light", width / 2, height / 2);
      fill(36, 255, 120);
      text("green light", width / 2, height / 1.7);
      pop();
      fill('white');
      textFont(breadFont);
      textSize(14);
      fill('lightgrey');
      text("THE DOLL SEES YOUR EVERY MOVE. \n YOU´RE ONLY SAFE WHEN SHE'S SINGING AND FACING AWAY.\n DO YOU HAVE WHAT IT TAKES TO SURVIVE?", width / 2, height / 5);


      // För att få texten at blinka. Millis räknar millisekunder och /180 och %4 avgör hur ofta det blinkar.
      let visible = (floor(millis() / 180) % 4) !== 0;

      if (visible) {
        // huvudtexten i grått
        textSize(18);
        fill('lightgrey');
        // texten ritas här, annars syns ingenting
        text("TO START: BOTH PLAYERS RAISE YOUR HANDS \n ABOVE YOUR HEAD AND BE READY TO RUN!", width / 2, height / 1.2);
      }
    }
    textAlign(LEFT);
    // återställ så resten av texten ritas som förut


    // STARTA MED EN POSE
    // När ljudet är igång, det inte är game over eller winnerplaying OCH båda tar upp händerna så ska följande ske:
    if (audioReady && !gameOverPlaying && !winnerPlaying && bothHandsUp()) {
      // I början av posen så ska poseStart sättas till den inbyggda funktionen millis, som räknas millisekunder
      if (poseStart === 0) poseStart = millis();
      // Om den räknade tiden är längre än holdTime (som vi satte till 1500 ms) så ska spelet starta. Posestart sätts då igen till 0. Docklåten spelas. Eliminated ska "nollställas" till false så att båda spelarna är med i tävlingen igen.
      if (millis() - poseStart > holdTime) {
        poseStart = 0;
        eliminated = { 1: false, 2: false };
        startSong();
      }
    } else {
      poseStart = 0;
      // om posen bröts, börja om
    }
  }
  // STARTA SPELET MED EN POSE (SLUT)



  // array över spelare som blev eliminerade just i den här bildrutan
  let newlyOut = [];

  // RITA TEXT FÖR VARJE SPELARE (player 1 och 2)
  for (let i = 0; i < people.length; i++) {
    // en person i people ska kallas för pose
    // personens plats ska läggas i variabeln slot
    // hämtar personens rörelsevärde och lägger det i m (som är förkortning för movement)
    let pose = people[i].pose;
    let slot = people[i].slot;
    let m = movementBySlot[slot] || 0;

    // om en rörelse är större än threshold så ska det räknas som too much och därmed elimineras
    let tooMuch = state === "silent" &&
      millis() - silentSince > graceTime &&
      m > threshold &&
      // person som är eliminerad ska dock inte räknas med, eftersom den redan är eliminerad
      !eliminated[slot];


    // OM SPELARE BLIVIT ELIMINRAD:
    // markera platsen som eliminerad och lägg platsen i arrayn för newlyout med hjälp av den inbyggda push-funktionen
    if (tooMuch) {
      eliminated[slot] = true;
      newlyOut.push(slot);
    }


    // RITA UPP TEXT OVANFÖR SPELARENS HUVUD
    // Gör en variabel för punkten som sitter på näsan, som texten sen ska utgå ifrån.
    let nose = pose.keypoints[0];
    // Om punkten är tillräckligt säker, rita upp texten "player (nummer)"
    if (nose.confidence > 0.1) {
      textSize(24);
      // grå färg om eliminerad, annars grön
      if (eliminated[slot]) {
        fill(150);
      } else {
        fill(0, 255, 0);
      }
      text("Player " + slot, width - nose.x - 35, nose.y - 60);
      textSize(20);
    }
  }
  //RITA UPP TEXT (SLUT) 


  // OUTPUT FÖR ELIMINERINGAR (text, ljus och ljud) START
  // Om arrayn med newlyout är mer än 0, alltså att det finns någon i arrayn som blivit eliminerad:
  // Om båda spelarna är eliminerade så ska "all players eliminated" visas samtidigt som motsvarande ljud spelas.
  if (newlyOut.length > 0) {
    if (eliminated[1] && eliminated[2]) {

      // ÄNDRA LAMPORNAS FÄRG TILL RÖTT
      hueLights = 0;
      satLights = 1;
      lamps();

      // Visa meddelande om eliminering
      showMessage("All players eliminated");
      playAllEliminatedSounds();
      resetGame();
    }
    // Annars, om bara en spelare är eliminerad, så ska ett meddelande om den utslagna personen i arrayn visas som bekräftar att den är eliminerad. Samtidigt ska motsvarande ljud spelas.
    else {
      // bara en spelare utslagen
      // OM player 1 har åkt ut
      if (newlyOut[0] === 1) {

        // Gör dessa manuellt och inte med funktionen lamps eftersom lamporna ska ha olika färger
        // ÄNDRA LAMPA PROFILE 23
        L('Profile 23', {
          dimmer: 255, hue: 0, sat: 1,
          pan: constrain(355.0890316258591 / width, 0, 1),
          tilt: constrain(201.4457831325301 / height, 0, 1),
        });

        // ÄNDRA LAMPA PROFILE 24
        L('Profile 24', {
          dimmer: 255, hue: 0, sat: 1,
          pan: constrain(355.0890316258591 / width, 0, 1),
          tilt: constrain(201.4457831325301 / height, 0, 1),
          zoom: 100
        });


        // ÄNDRA LAMPA PROFILE 25
        L('Profile 25', {
          dimmer: 255, hue: 0, sat: 1,
          pan: constrain(355.0890316258591 / width, 0, 1),
          tilt: constrain(201.4457831325301 / height, 0, 1),
          zoom: 100
        });


        // ÄNDRA LAMPA WASH 38
        L('Wash 38', {
          dimmer: 255, hue: 0, sat: 0,
          pan: constrain(194.73914706829896 / width, 0, 1),
          tilt: constrain(200.7448256159403 / height, 0, 1)
        });


        // ÄNDRA LAMPA WASH 39
        L('Wash 39', {
          dimmer: 255, hue: 0, sat: 0,
          pan: constrain(194.73914706829896 / width, 0, 1),
          tilt: constrain(200.7448256159403 / height, 0, 1),
          zoom: 10
        });


        // ÄNDRA LAMPA WASH 40
        L('Wash 40', {
          dimmer: 255, hue: 0, sat: 0,
          pan: constrain(194.73914706829896 / width, 0, 1),
          tilt: constrain(200.7448256159403 / height, 0, 1)
        });



      }


      // Om spelare 2 åkt ut
      else if (newlyOut[0] === 2) {

        // ÄNDRA LAMPA PROFILE 23
        L('Profile 23', {
          dimmer: 255, hue: 0, sat: 0,
          pan: constrain(355.0890316258591 / width, 0, 1),
          tilt: constrain(201.4457831325301 / height, 0, 1),
        });

        // ÄNDRA LAMPA PROFILE 24
        L('Profile 24', {
          dimmer: 255, hue: 0, sat: 0,
          pan: constrain(355.0890316258591 / width, 0, 1),
          tilt: constrain(201.4457831325301 / height, 0, 1),
        });


        // ÄNDRA LAMPA PROFILE 25
        L('Profile 25', {
          dimmer: 255, hue: 0, sat: 0,
          pan: constrain(355.0890316258591 / width, 0, 1),
          tilt: constrain(201.4457831325301 / height, 0, 1),
        });


        // ÄNDRA LAMPA WASH 38
        L('Wash 38', {
          dimmer: 255, hue: 0, sat: 1,
          pan: constrain(194.73914706829896 / width, 0, 1),
          tilt: constrain(200.7448256159403 / height, 0, 1)
        });


        // ÄNDRA LAMPA WASH 39
        L('Wash 39', {
          dimmer: 255, hue: 0, sat: 1,
          pan: constrain(194.73914706829896 / width, 0, 1),
          tilt: constrain(200.7448256159403 / height, 0, 1),
          zoom: 10
        });


        // ÄNDRA LAMPA WASH 40
        L('Wash 40', {
          dimmer: 255, hue: 0, sat: 1,
          pan: constrain(194.73914706829896 / width, 0, 1),
          tilt: constrain(200.7448256159403 / height, 0, 1)
        });



      }
      showMessage("Player " + newlyOut[0] + " eliminated");
      playEliminatedSound(newlyOut[0]);
    }
  }
  // OUTPUT FÖR ELIMINERINGAR (text och ljud) SLUT


  // VISA BILDER

  // visa grisen medan vinstljudet spelas
  if (winnerPlaying) {
    push();
    imageMode(CENTER);
    image(pig, width / 2, height / 2, 500, 500);
    pop();
  }

  // RITA DOCKAN + text beroende på state
  if (state === "playing") {

    // när dockan sjunger så hon har ryggen mot spelarna
    push();
    textFont(squidGameFont);
    textAlign(CENTER);
    imageMode(CENTER);
    image(dockaBak, width / 2, height / 1.2);
    fill(0, 255, 0);
    textSize(60);
    text('RUN', width / 2, 70);
    pop();
  } else if (state === "silent") {
    //när dockan inte sjunger så är hon vänd mot spelarna
    push();
    textFont(squidGameFont);
    textAlign(CENTER);
    imageMode(CENTER);
    image(dockaFram, width / 2, height / 1.2);
    fill(255, 0, 0);
    textSize(60);
    text('STOP', width / 2, 70);
    pop();
  }


  // INSTÄLLNINGAR FÖR MEDDELANDEN
  // Så länge räknaren millis() inte är längre än messageUntil, som vi satt som 3 sekunder, så ska meddelandet visas och då med dessa inställningar:
  if (millis() < messageUntil) {
    textAlign(CENTER);

    // Om det är game over -meddelandet så vill vi ha lite större röd text och att den glitchar
    if (message === "GAME OVER") {
      // GAME OVER: blodröd, större och glitchar
      push();
      textFont(squidGameFont);
      textSize(90);
      stroke(0);
      strokeWeight(8);

      // blinkar: av och på en kort stund då och då
      let visible = (floor(millis() / 120) % 8) !== 0;

      if (visible) {
        // glitchen består av en röd och en cyan kopia av texten som förskjuts slumpmässigt bakom huvudtexten
        // glitch ca 30% av framsen och det rör sig mellan-8 och 8 pixlar
        let glitch = random() < 0.3 ? random(-8, 8) : 0;
        noStroke();
        fill(0, 255, 255, 120);
        text(message, width / 2 + glitch, height / 2 - glitch / 2);
        fill(255, 0, 0, 120);
        text(message, width / 2 - glitch, height / 2 + glitch / 2);

        // huvudtexten i rött
        stroke(0);
        strokeWeight(8);
        fill(138, 3, 3);
        // ibland hoppar hela texten lite i sidled
        text(message, width / 2 + (random() < 0.1 ? random(-10, 10) : 0), height / 2);
      }
      pop();
    }

    // Om meddelandet är vinsttexten
    else if (message.toLowerCase().endsWith("wins!")) {
      // VINST: grön, större och glitchar
      push();
      textFont(squidGameFont);
      textSize(60);
      stroke(0);
      strokeWeight(8);

      // blinkar
      let visible = (floor(millis() / 70) % 4) !== 0;
      if (visible) {
        // huvudtexten i grönt
        stroke(0);
        strokeWeight(8);
        fill(36, 255, 120);
        text(message, width / 2, height / 2);
      }
      pop();
    } else {
      // vanliga meddelanden (som elimineringar)
      push();
      fill(255, 0, 0);
      stroke(0);
      strokeWeight(6);
      textSize(48);
      text(message, width / 2, height / 2);
      pop();
    }

    textAlign(LEFT);
    noStroke();
  }
}
// DRAW SLUT



// FUNKTIONER 


// LAMPOR BYTER FÄRG
function lamps() {

  // ÄNDRA LAMPA PROFILE 23
  L('Profile 23', {
    // dimmer is the brightness of light, 255 is fully on. Hue is the color. saturation is saturation. Keep sat 1 for now
    dimmer: 100, hue: hueLights, sat: satLights,
    // pan is the angle, like standing below the light and spining around.
    // Tilt is how far 
    pan: constrain(355.0890316258591 / width, 0, 1),
    tilt: constrain(201.4457831325301 / height, 0, 1),
  });

  // ÄNDRA LAMPA PROFILE 24
  L('Profile 24', {
    dimmer: 100, hue: hueLights, sat: satLights,
    pan: constrain(355.0890316258591 / width, 0, 1),
    tilt: constrain(201.4457831325301 / height, 0, 1),
  });


  // ÄNDRA LAMPA PROFILE 25
  L('Profile 25', {
    dimmer: 100, hue: hueLights, sat: satLights,
    pan: constrain(355.0890316258591 / width, 0, 1),
    tilt: constrain(201.4457831325301 / height, 0, 1),
  });


  // ÄNDRA LAMPA WASH 38
  L('Wash 38', {
    dimmer: 255, hue: hueLights, sat: satLights,
    pan: constrain(194.73914706829896 / width, 0, 1),
    tilt: constrain(200.7448256159403 / height, 0, 1),
  });


  // ÄNDRA LAMPA WASH 39
  L('Wash 39', {
    dimmer: 255, hue: hueLights, sat: satLights,
    pan: constrain(194.73914706829896 / width, 0, 1),
    tilt: constrain(200.7448256159403 / height, 0, 1),
  });


  // ÄNDRA LAMPA WASH 40
  L('Wash 40', {
    dimmer: 255, hue: hueLights, sat: satLights,
    pan: constrain(194.73914706829896 / width, 0, 1),
    tilt: constrain(200.7448256159403 / height, 0, 1)
  });


}


// VISA MEDDELANDE
function showMessage(txt) {
  // txt är platshållare för texten som vi lägger in meddelandet i
  message = txt;
  // medddelande ska visat till och med messageTime, vilket vi har satt som 3 sekunder
  messageUntil = millis() + messageTime;
}


// LJUD FÖR ELIMINERING
// spelar ljudet för spelare 1 eller 2 baserat på vilken slot som blivit eliminerad
function playEliminatedSound(slot) {
  let sound;
  if (slot === 1) {
    sound = player1Sound;
  } else {
    sound = player2Sound;
  }
  // börja från början
  sound.elt.currentTime = 0;
  sound.play();
}

// båda eliminerade --> spela Allplayerseliminated (Gameover följer när det är klart)
function playAllEliminatedSounds() {
  gameOverPlaying = true;

  // stoppa enskilda spelarljud så de inte spelas över varandra, ifall en åker ut och den andra precis efter
  player1Sound.pause();
  player2Sound.pause();

  allPlayersSound.elt.currentTime = 0;
  allPlayersSound.play();
}

// körs automatiskt när Allplayerseliminated är slut eftersom vi har .onended
function playGameOver() {
  showMessage("GAME OVER");
  // texten visas tills Gameover-ljudet är slut (endSongFinished nollställer den)
  messageUntil = Infinity;
  gameOverSound.elt.currentTime = 0;
  gameOverSound.play();
}

// STARTA OM SPELET
// körs automatiskt när Gameovereller vinstlåten är slut pga .onended
function endSongFinished() {
  gameOverPlaying = false;
  winnerPlaying = false;
  // döljer text när ljudet är slut
  messageUntil = 0;
  theme.time(0);
  theme.loop(); // temalåten startar och spelet kan startas igen
}


// startar om hela spelet och gåt tillbaka till väntläget
function resetGame() {
  // avbryter planerad nästa musikomgång
  clearTimeout(nextSongTimer);
  song.pause();
  state = "waiting";
  poseStart = 0;
  movementBySlot = {};
}

// MUSIK
// ett klick som aktiverar ljudet (eftersom webbläsaren kräver det) och startar temalåten
function mousePressed() {
  if (!audioReady && song) {

    // aktivera ljudeffekterna och låtar, så de får spelas senare uta att man behöver klicka igen
    unlockSound(song);
    unlockSound(player1Sound);
    unlockSound(player2Sound);
    unlockSound(allPlayersSound);
    unlockSound(gameOverSound);
    unlockSound(winnerSound);

    audioReady = true;
    // starta temalåten i loop
    theme.loop();
  }
}

// spelar upp ljudet ljudlöst en kort stund och pausar det
// Funktion som "låser upp" ett ljud så att webbläsaren tillåter att man spelar ljud utan att behöva klicka flera gånger
function unlockSound(sound) {
  sound.elt.muted = true;
  sound.elt.play().then(() => {
    sound.elt.pause();
    sound.elt.currentTime = 0;
    sound.elt.muted = false;
  }).catch(() => {
    sound.elt.muted = false;
  });
}

// START AV SPEL
function startSong() {
  theme.pause();
  theme.time(0);
  state = "playing";

  // GRÖNA LAMPOR NÄR DOCKAN SJUNGER OCH SPELET STARTAR
  hueLights = 120;
  satLights = 1;
  lamps();

  let r = random(1.5, 3);

  song.elt.currentTime = 0;
  // låten ska spelas i slumpmässig hastighet mellan 1.5 - 3 för att göra spelet mindre förutsägbart.
  song.elt.defaultPlaybackRate = r;
  song.elt.playbackRate = r;
  song.elt.preservesPitch = true;
  song.elt.webkitPreservesPitch = true;

  song.play();
  song.elt.playbackRate = r;

  song.onended(songEnded);
}

// NÄR MAN STÅR STILLA
function songEnded() {
  if (state !== "playing") return; // ignorera om spelet redan startats om
  state = "silent";
  // för att räkna ms från när musiken stoppades
  silentSince = millis();


  // VITA LAMPOR NÄR STILLA 
  hueLights = 0;
  satLights = 0;
  lamps();


  // Starta låten igen efter fem sekunder
  nextSongTimer = setTimeout(startSong, 5000);
}


// STARTA SPEL MED POSE
function bothHandsUp() {
  // vi måste se två personer
  if (people.length < 2) return false;

  // Gå igenom personerna i listan och kalla punkterna för k. Ta näsans och handledernas keypoints
  for (let i = 0; i < people.length; i++) {
    let k = people[i].pose.keypoints;
    let nose = k[0];
    let leftWrist = k[9];
    let rightWrist = k[10];

    // om någon punkt inte syns tillräckligt bra räknas det inte
    if (nose.confidence < 0.1 || leftWrist.confidence < 0.1 || rightWrist.confidence < 0.1) {
      return false;
    }
    // handlederna ska vara ovanför näsan (mindre y = högre upp på skärmen)
    if (leftWrist.y > nose.y || rightWrist.y > nose.y) {
      return false;
    }
  }
  return true;
}

// FUNKTION FÖR ATT AVGÖRA VEM SOM ÄR NÄRMAST KAMERAN
function closest() {
  // vi måste se två personer
  if (people.length < 2) return false;

  // hämta punkterna för varje spelare och lägg i variabel
  let k1 = people[0].pose.keypoints; // plats 1 (vänster)
  let k2 = people[1].pose.keypoints; // plats 2 (höger)

  // För att avgöra vem som står närmast räknar vi avståndet mellan ögonen. Gör variabler för ögonpunkterna
  let leftEye1 = k1[1];
  let rightEye1 = k1[2];
  let leftEye2 = k2[1];
  let rightEye2 = k2[2];

  // om någon punkt inte är säker så ska den inte räknas med
  if (leftEye1.confidence < 0.1 || rightEye1.confidence < 0.1) {
    return false;
  }
  // om avståndet mellan ögonen är större för en spelare så ska den spelarens nummer returnas. 
  if (leftEye1.x - rightEye1.x > leftEye2.x - rightEye2.x) {
    return 1;
  }
  else {
    return 2;
  }

}


// Knappen är kopplad till microbit
function keyPressed() {
  if (key === "c" || key === "C") {
    connectMicrobit();
  }
}

// VISA VINNARE
function declareWinner() {

  // Gula lampor
  hueLights = 60;
  satLights = 1;
  lamps();

  if (state === "playing" || state === "silent") {
    let winner = 0;

    // Om den ena är eliminerad så måste den andra vara vinnare. Om båda är med så är det förmdodligast den som tryckt på knappen och därmed vinner.
    if (eliminated[1] && !eliminated[2]) winner = 2;
    if (eliminated[2] && !eliminated[1]) winner = 1;
    if (!eliminated[2] && !eliminated[1]) winner = closest();

    if (winner === 1 || winner === 2) {
      showMessage("Player " + winner + " wins!");
      messageUntil = Infinity;
      winnerPlaying = true;
      winnerSound.elt.currentTime = 0;
      winnerSound.play();
      resetGame();
    }
    // För att det inte ska stå "player false wins" om kameran inte uppfattar vem som står närmast, så gör vi ett annat alternativ
    else {
      showMessage("You won!");
      messageUntil = Infinity;
      winnerPlaying = true;
      winnerSound.elt.currentTime = 0;
      winnerSound.play();
      resetGame();
    }
  }
}


// FUNKTIONER SOM TAR EMOT RESULTAT FRÅN BODY TRACKINGEN
function gotPoses(results) {
  poses = results;

  // 1. RÄKNA UT VEM SOM ÄR PLAYER 1 OCH 2 BASERAT PÅ VAR DE STÅR
  // skapar en tom array
  let found = [];
  for (let i = 0; i < results.length; i++) {
    // kallar resultaten för varje kropp för pose
    let pose = results[i];
    // variabel för summan av x-värdena
    let sumX = 0;
    // variabel som räknar antal punkter
    let n = 0;
    // går igenom keypointsen och lägger ihop x-värdena för alla säkra punkter (mer än 10%)
    for (let j = 0; j < pose.keypoints.length; j++) {
      if (pose.keypoints[j].confidence > 0.1) {
        // lägg till ny punkt i summan
        sumX += pose.keypoints[j].x;
        // samtidigt ska räknaren öka med 1
        n++;
      }
    }
    // om det är färre än 5 säkra punkter så är det troligen inte en riktig person, därmed hoppa över
    if (n < 5) continue;
    found.push({ pose: pose, n: n, x: width - sumX / n });
  }

  // 2.BEHÅLL DE TVÅ PERSONER MED FLEST SÄKRA PUNKTER, alltså flest n
  // Sorting-funktion där b läggs först i listan om b - a är positivt. Tex 5-3 är 2. Om 5=b ska alltså b läggas först.
  found.sort((a, b) => b.n - a.n);
  // slice skär av den nya listan, i detta fall mellan 0-2 exklusive 2 (allstå 0 och 1, de två första platserna, eftersom vi bara vill ha två personer som kan spela)
  found = found.slice(0, 2);

  // 3. PLACERA 1 OCH 2 I ORDNING UTIFRÅN VAR DE STÅR
  // Sorting-funktionen igen fast denna gång sortera listan med max 2 personer från höger itll vänster utifrån deras x-värden som vi räknade ut i steg 1. 
  found.sort((a, b) => a.x - b.x);

  // 4. DELAR UT PLATSER.
  // Plats 1 = vänster, plats 2 = höger.
  // Om längden på den nya found-listan är 2 så ska den första i ordningen vara slot 1, alltså vänster, och den andra i slot 2, alltså höger.
  if (found.length === 2) {
    found[0].slot = 1;
    found[1].slot = 2;
    // Om det bara finns en person i listan så ska den personen få plats 1 eller 2 baserat på dess x-värde. 
    // Om x-värdet är mindre än halva bildbredden ska den sättas i plats 1, annars 2. ? är en kortare variant av en if-sats.
  } else if (found.length === 1) {
    found[0].slot = found[0].x < width / 2 ? 1 : 2;
  }
  // Lägg all den nya informationen om resultatet i variabeln people
  people = found;


  // 5. RÄKNA UT RÖRELSE PER PLATS
  // skapar ett objekt för att spara info om punkterna i den nuvarande framen
  let newPrev = {};
  // Går igenom listan med kroppar och sparar kroppen och platsen i variabler
  for (let i = 0; i < people.length; i++) {
    let pose = people[i].pose;
    let slot = people[i].slot;

    // Hur långt alla punkter har rört sig
    let total = 0;
    // räknare för antal punkter, för att kunna ta medelvärdet
    let count = 0;
    // lägger in slots från förra framen i variabeln prev
    let prev = prevBySlot[slot];

    // Om det finns tidigare data (alltså någon info om förra framens punkter):
    if (prev) {
      for (let j = 0; j < pose.keypoints.length; j++) {
        // kalla de nuvarande keypointsen för varje punkt på kroppen för c (som current)
        let c = pose.keypoints[j];
        // kalla den förra framens keypoints för p (previous)
        let p = prev[j];
        // om denna specifika punkt fanns förra gången (p), och om både nuvarande och förra punkten är minst 10% säker --> räkna ut distansen mellan punkternas x-värden och y-värden samt öka count med 1. 
        if (p && c.confidence > 0.1 && p.confidence > 0.1) {
          total += dist(c.x, c.y, p.x, p.y);
          count++;
        }
      }
    }

    // Om minst 1 punkt har jämförts så hämtar vi det gamla värdet igen och lägger det i variabeln old. Om inget hittats så ta 0
    if (count > 0) {
      let old = movementBySlot[slot] || 0;
      // lerp jämnar ut värdena så en enstaka vibrerande punkt inte utlöser eliminering. Den tar det gamla värdet och det nya medelvärdet och tar 80% av det första och 20% av det andra, därav siffran 0.2.
      movementBySlot[slot] = lerp(old, total / count, 0.2);
    }

    // sparar en kopia av punkterna i den nya bildrutan
    newPrev[slot] = pose.keypoints.map(k => ({ x: k.x, y: k.y, confidence: k.confidence }));
  }

  // platser utan person nollställs, så en ny person som kommer in i bilden börjar från noll
  // Går igenom slotsen och säger att om det inte finns nån tidigare info om punkternas platser i sloten så ska den personens rörelser nollställas. Detta görs så att man kommer in som ny spelare från 0 och inte kallas player 3, 4, 5 etc.
  for (let slot = 1; slot <= 2; slot++) {
    if (!newPrev[slot]) movementBySlot[slot] = 0;
  }
  // byter ut den gamla framens värden med den nya, som nästa frame ska kunna jämföra med.
  prevBySlot = newPrev;
}



// MICROBIT
let port;

// koppla microbit
async function connectMicrobit() {
  try {
    // öppnar rutan i webbläsaren där vi väljer att ansluta till microbitens usb
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    console.log("Micro:bit ansluten");

    // Gör om sifferinput till text
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();

    // i buffer läggs infon från microbiten
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      // Lägger inputen i rader med radbrytning
      let lines = buffer.split("\n");
      buffer = lines.pop();

      for (let line of lines) {
        console.log("Fick:", JSON.stringify(line));
        // om inputen från microbiten är exakt "B" (vilket i koden för microbiten är kopplad till knapptrycket) så ska funktionen declairewinner köras
        if (line.trim() === "B") {
          declareWinner();
        }
      }
    }
    // Om nåt går fel
  } catch (err) {
    console.log("Kunde inte ansluta:", err);
  }
}

// KODEN FRÅN MAKECODE.MICROBIT.ORG
// pins.setPull(DigitalPin.P0, PinPullMode.PullUp)
// let wasPressed = false

// basic.forever(function () {
//     let pressed = pins.digitalReadPin(DigitalPin.P0) == 0
//     if (pressed && !wasPressed) {
//         serial.writeLine("B")
//         basic.showIcon(IconNames.Yes)
//         basic.clearScreen()
//     }
//     wasPressed = pressed
//     basic.pause(20)
// })

// input.onButtonPressed(Button.A, function () {
//     serial.writeLine("B")
// })


// Funktion för att kunna ställa in lampornas position på rätt plats med hjälp av musens plats på skärmen
// function mousePressed() {
//   console.log(mouseX, mouseY);
// }
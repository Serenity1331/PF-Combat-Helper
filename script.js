"use strict"

function showMonsters() {

    fetch('./dbFiles/Bestiary_Names_Only.xml')  // second file with data should be added later
    .then(res => res.text())
    .then(data => {
        let parser = new DOMParser();
        let xmlDOM = parser.parseFromString(data, 'application/xml');
        let monsters = xmlDOM.querySelectorAll('Monster');

        let lst = [];

        monsters.forEach(monster => lst.push([monster.children[0].innerHTML, monster.children[1].innerHTML]));
        let sorted = lst.sort();    // not sure if it works correctly

        for (let name of sorted) {

            let li = document.createElement("li");
            li.innerHTML = name[0];
            li.setAttribute('monsterId', name[1]);
            addClickListener(li);

            let ol = document.querySelector('.monsterList');
            ol.appendChild(li);
         }

    });
}

    // Probably the main root function
function addClickListener(elem) {

    elem.addEventListener('click', async function() {
        let id = elem.getAttribute('monsterId');
        let data = await extractData(id);
        createMonsterFieldset(data);
    });

    // to add 'Enter' as a way to choose a monster
}


function showFullMonsterData(obj) {
    
    function insertText(elemClass, data) {
        document.querySelector(elemClass).innerHTML = data ? data : '-';
    }

    let data = {
                '.mName': obj.name, 
                '.hp': obj.hp, 
                '.init': obj.init,
                '.size': obj.size,
                '.type': obj.type,
                '.DR': obj.DR,
                '.SR': obj.SR,
                '.immune': obj.immune,
                '.resist': obj.resist,
                '.speed': obj.speed,
                '.feats': obj.feats,
                '.specialAttacks': obj.specialAttacks,
                '.specialAbilities': obj.specialAbilities,
                '.aura': obj.aura,
                '.languages': obj.languages,
                '.weaknesses': obj.weaknesses,
                '.sq': obj.SQ,
                '.meleeFull': obj.fullMeleeString,
                '.rangedFull': obj.fullRangedString,
                '.CMB': obj.CMB,
                '.CMD': obj.CMD,
                '.space': obj.space,
                '.reach': obj.reach,
                '.defensiveAbilities': obj.defensiveAbilities,
            }
    for (let [key, value] of Object.entries(data)) {
        insertText(key, value);
    }
}

function createMonsterFieldset(data) {

    let fSet = document.createElement('fieldset');
    let legend = createMonsterTitle(data.name); 
    let closeBtn = createRemoveBtn('monster');
    let firstField = createFirstDataField(data);
    let secondField = createAttackDataField(data, 'Melee');
    let thirdField = createAttackDataField(data, 'Ranged');

    fSet.appendChild(closeBtn);
    fSet.appendChild(legend);
    fSet.appendChild(firstField);
    fSet.appendChild(secondField);
    fSet.appendChild(thirdField);
    fSet.classList.add('monsterShort');

    fSet.addEventListener('click', function(e) {
        
        let lst = ['monsterShort', 'firstLine', 'attackLine']; //to avoid event bubbling from inputs
        if (lst.includes(e.target.className)) {
            clearMonsterBgColors();
            this.classList.add('darkBlue');
            showFullMonsterData(data);
        }
    })

    let encounter = document.querySelector('.encounter');
    encounter.appendChild(fSet);
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}


function createAttackBtns(object, attackType, specialAttacks = null, attackNumber = 0) {
    // this "object" is not equal to whole monster object

    let div = document.createElement("div");
    attackType === 'Ranged' ? div.classList.add("rollRangedAttack") : div.classList.add("rollAttack");
    let weapon = capitalize(object.weaponName);

    div.setAttribute('data-tooltip', weapon);

    function attack(e) {
        e.stopImmediatePropagation();
        if (e.target.classList.contains('disabledMelee') || e.target.classList.contains('disabledRanged') ) {
            return;
        }
        let sneakDmg = 0;
        let sneakAtkBtn = e.target.parentNode.parentNode.querySelector('.sneaky');
        
        if (sneakAtkBtn) {
            sneakDmg = decodeSneakAttack(specialAttacks);
        }

        
        let arr = hitOrMiss(object, attackNumber, sneakDmg);
        
        showAttackResults(arr);
        disableBtn(e);
    }

    div.addEventListener('click', attack);
    div.addEventListener('contextmenu', enableBtn);

    return div;
}

function decipherBonusDamage(string) {
    
    let original = string;
    let str = string ? string.match(/\d+d\d+[+-]?\d?\d?/gi) : null;
    let newString = '';

    if (str) {
        //replacing each xdy (1d6, 2d8 etc.) with the calculated damage
        for (let s of str) {
            let dmg = calculateDamage(s);
            newString = string.replace(/\d+d\d+[+-]?\d?\d?/i, dmg);
            string = newString;
        }
        return string
    }   
    return original;
}

// ---------------- Showing the results of monster attacks ----------------

function showAttackResults(arr) {

    let r = document.querySelectorAll('.atkResult span');

    r[0].innerHTML = arr[0];
    r[1].innerHTML = arr[1];
    r[2].innerHTML = arr[2];
    r[3].innerHTML = arr[3];
    r[4].innerHTML = arr[4];

}

function attackRollIsNat20(damage, toHit, AC, critMod, bonusDamage, sneakDmg) {

    let cRoll = getRandomInt(1,20); //Confirmation Roll
    let total = cRoll + toHit;
    let critDmg = damage * critMod;
        
    if (cRoll === 1)  return [`Nat 20!`, 
                              'Failed to confirm: Natural 1', 
                              `${damage} damage`, 
                              bonusDamage, 
                              sneakDmg];

    if (cRoll === 20) return [`Nat 20!`, 
                              `Confirmation: double Nat 20 !!!`, 
                              `${damage} * ${critMod} = ${critDmg} damage`, 
                              bonusDamage, 
                              sneakDmg];

    if (total >= AC)  return ['Nat 20!', 
                              `Crit Confirmed: ${cRoll} + ${toHit} = ${total} >= ${AC}`, 
                              `${damage} * ${critMod} = ${critDmg} damage`, 
                              bonusDamage,
                              sneakDmg];

                      return ['Nat 20!', 
                              `Failed to confirm: ${cRoll} + ${toHit} = ${cRoll + toHit} < ${AC}`,
                              `${damage} damage`, 
                              bonusDamage, 
                              sneakDmg];
}

function aHitAndCritThreat(damage, toHit, AC, randomRoll, critMod, total, bonusDamage, sneakDmg) {

    let cRoll = getRandomInt(1,20);
    let confirmTotal = cRoll + toHit;
    let critThreat = `Critical Threat: ${randomRoll} + ${toHit} = ${total} >= ${AC}`;
    let critDmg = damage * critMod;

    if (cRoll === 1)        return [critThreat, 
                                    'Failed to confirm: Natural 1', 
                                    `${damage} damage`, 
                                    bonusDamage, 
                                    sneakDmg];

    if (confirmTotal >= AC) return [critThreat, 
                                    `Crit Confirmed: ${cRoll} + ${toHit} = ${confirmTotal} >= ${AC}`, 
                                    `${damage} * ${critMod} = ${critDmg} damage`, 
                                    bonusDamage, 
                                    sneakDmg];

                            return [critThreat, 
                                    `Failed to confirm: ${cRoll} + ${toHit} = ${confirmTotal} < ${AC}`, 
                                    `${damage} damage`, 
                                    bonusDamage, 
                                    sneakDmg];
}

function aHitButNoCritThreat(damage, toHit, AC, randomRoll, total, bonusDamage, sneakDmg) {
    return ['', 
            `Attack Roll: ${randomRoll} + ${toHit} = ${total} >= ${AC}`, 
            `${damage} damage`, 
            bonusDamage, 
            sneakDmg];
}

function aMiss(randomRoll, toHit, AC) {
    return ['', '', `Miss: ${randomRoll} + ${toHit} < ${AC}`, '', ''];
}

function attackRollIsNat1() {
    return ['', '', `Miss: Natural 1`, '', '', ''];
}

function swarmOrTroopAttack(damage, bonusDamage, sneakDmg) {
    return ['', 
            'Auto-Hit', 
            `${damage} damage`, 
            bonusDamage, 
            sneakDmg];
}

function hitOrMiss(object, attackNumber, sneakDmg) {  // attackNumber is needed to interpret +15/+10/+5 as multiple attacks

    let bonusDmg = decipherBonusDamage(object.bonusInfo) ? decipherBonusDamage(object.bonusInfo) + '<br' : '';
    sneakDmg = sneakDmg !== 0 ? `Sneak attack: ${sneakDmg} damage` : '';
    let damage = calculateDamage(object.damage);
    let critModifier = object.critMod ? +object.critMod.split('x')[1] : 2;
    let cRange = object.critRange ? decipherCritRange(object.critRange) : [20];
    let playerAC = getPlayerAC();

    let randomRoll = getRandomInt(1,20);
    let isCritThreat = cRange.includes(randomRoll);

    if (isSwarmOrTroop(object.weaponName)) return swarmOrTroopAttack(damage, bonusDmg, sneakDmg);

    let toHitBonus = parseInt(object.toHit.split('/')[attackNumber]);
    let total = randomRoll + toHitBonus;
 
    if (randomRoll === 1)                   return attackRollIsNat1();
    if (randomRoll === 20)                  return attackRollIsNat20(damage, toHitBonus, playerAC, critModifier, bonusDmg, sneakDmg);
    if (total < playerAC)                   return aMiss(randomRoll, toHitBonus, playerAC);
    if (total >= playerAC && isCritThreat)  return aHitAndCritThreat(damage, toHitBonus, playerAC, randomRoll, critModifier, total, bonusDmg, sneakDmg);
                                            return aHitButNoCritThreat(damage, toHitBonus, playerAC, randomRoll, total, bonusDmg, sneakDmg);                       
}


// ------------------ Showing the results of monster attacks -- Finished -----------------

function disableBtn(e) {

    let classes = e.target.classList;

    if (classes.contains('rollAttack')) {
        classes.remove('rollAttack');
        classes.add('disabledMelee');

    } else if (classes.contains('rollRangedAttack')) {
        classes.remove('rollRangedAttack');
        classes.add('disabledRanged');
    }

}

function enableBtn(e) {
    e.preventDefault();

    let classes = e.target.classList;

    if (classes.contains('disabledMelee')) {
        classes.remove('disabledMelee');
        classes.add('rollAttack');

    } else if (classes.contains('disabledRanged')) {
        classes.remove('disabledRanged');
        classes.add('rollRangedAttack');
    }
}


// Saves names and ACs
function saveData() {
    let nameWrappers = document.querySelectorAll('.nameWrapper');
    let players = [];

    for (let nameWrapper of nameWrappers) {
       
        let obj = {};

        for (let elem of nameWrapper.children) {
            obj[elem.name] = elem.value;
        }
        // localStorage.setItem(name, JSON.stringify(obj));
        players.push(JSON.stringify(obj));
    }

    localStorage.setItem('PF_Heroes', JSON.stringify(players));

    alert('Saved!')
}

function saveDataListener() {
    let btn = document.querySelector('.saveData');
    btn.addEventListener('click', function() {
        saveData();
    })
}

function loadData() {
    let players = JSON.parse(localStorage.getItem('PF_Heroes'));
    removePlayers();

    for (let player of players) {
        player = JSON.parse(player);
        loadPlayer(player);
    }

    setPlayerNumberToRoot();
    removePlayerListener();
}

function setPlayerNumberToRoot() {
    let numOfPlayers = document.querySelectorAll('.nameWrapper').length;
    document.documentElement.style.setProperty("--players", `${numOfPlayers}`);
}

function loadDataListener() {
    let btn = document.querySelector('.loadData');

    btn.addEventListener('click', function() {
        loadData();
    })
}

function removePlayers() {
    let players = document.querySelectorAll(".nameWrapper");
    for (let p of players) {
        p.remove();
    }
}

function loadPlayer(values) {

    let { pName, standardAC, touchAC, ffAC, bonusOrPenalty } = values;

    let playerString = 
    `<div class="nameWrapper">
        <input type="text" class="pName" name="pName" autocomplete="off" placeholder="Character Name" value=${pName}>
        <input type="text" class="standardAC AC" name="standardAC" autocomplete="off" placeholder="AC" value=${standardAC}>
        <input type="text" class="touchAC AC" name="touchAC" autocomplete="off" placeholder="AC" value=${touchAC}>
        <input type="text" class="ffAC AC" name="ffAC" autocomplete="off" placeholder="AC" value=${ffAC}>
        <input type="text" class="bonusOrPenalty" name="bonusOrPenalty" autocomplete="off" placeholder="AC bonus" value=${bonusOrPenalty}>
        <div class="removeBtn"></div>
    </div>`;

    let playerNames = document.querySelector('.playerNames');
    playerNames.insertAdjacentHTML('beforeend', playerString);
    choosePlayerListener();
}

function recoverAttacksListener() {
    let btn = document.querySelector('.recoverAttacks');

    btn.addEventListener('click', function() {
        let meleeBtns = document.querySelectorAll('.disabledMelee');
        let rangedBtns = document.querySelectorAll('.disabledRanged');
        
        meleeBtns.forEach(button => {
            button.classList.remove('disabledMelee');
            button.classList.add('rollAttack');
        })

        rangedBtns.forEach(button => {
            button.classList.remove('disabledRanged');
            button.classList.add('rollRangedAttack');
        })

    })
}

function addNewPlayer() {
    let playerString = 
        `<div class="nameWrapper">
        <input type="text" class="pName"            name="pName"        autocomplete="off" placeholder="Character Name">
        <input type="text" class="standardAC AC"    name="standardAC"   autocomplete="off" placeholder="AC">
        <input type="text" class="touchAC AC"       name="touchAC"      autocomplete="off" placeholder="AC">
        <input type="text" class="ffAC AC"          name="ffAC"         autocomplete="off" placeholder="AC">
        <input type="text" class="bonusOrPenalty"   name="bonusOrPenalty" autocomplete="off" placeholder="AC bonus">
        </div>`;

    let playerNames = document.querySelector('.playerNames');
    playerNames.insertAdjacentHTML('beforeend', playerString);
    choosePlayerListener();
    // let num = +getComputedStyle(document.documentElement).getPropertyValue("--players") + 1;
    setPlayerNumberToRoot();

    let closeBtn = createRemoveBtn();
    let allPlayers = document.querySelectorAll('.nameWrapper');
    let lastPlayer = allPlayers[allPlayers.length - 1];
    lastPlayer.append(closeBtn);
}

function addNewPlayerListener() {
    let btn = document.querySelector('.addNewPlayer');
    btn.addEventListener('click', function() {
        addNewPlayer();
    })
}

function init() {
    showMonsters();
    addNewPlayerListener();
    addSearchListener();
    saveDataListener();
    loadDataListener();
    choosePlayerListener();
    removePlayerListener();
    recoverAttacksListener()
}

async function extractData(id) {

    function checkForNull(nodeName, parent) {
        return parent.querySelector(nodeName) ? parent.querySelector(nodeName).innerHTML : null;
    }

    let myData = {};

    await fetch('dbFiles/Bestiary_Relevant.xml')
    .then(res => res.text())
    .then(data => {
        let parser = new DOMParser();
        let xmlDOM = parser.parseFromString(data, 'application/xml');      
        let ids = xmlDOM.querySelectorAll('id');
        for (let n of ids) {
            
            if (n.innerHTML === id) {

                let parent = n.parentNode;
                myData.id = id;
                myData.melee = decipherString(parent, 'Melee');
                myData.ranged = decipherString(parent, 'Ranged');
                myData.savingThrows = decipherSavingThrows(parent);

                myData.fullMeleeString = checkForNull('Melee', parent);
                myData.fullRangedString = checkForNull('Ranged', parent);
                myData.name =      checkForNull('Name', parent);
                myData.hp =        checkForNull('HP', parent);
                myData.init =      checkForNull('Init', parent);
                myData.size =      checkForNull('Size', parent);
                myData.type =      checkForNull('Type', parent);
                myData.AC =        checkForNull('AC', parent);
                myData.DR =        checkForNull('DR', parent);
                myData.immune =    checkForNull('Immune', parent);
                myData.resist =    checkForNull('Resist', parent);
                myData.SR =        checkForNull('SR', parent);
                myData.speed =     checkForNull('Speed', parent);
                myData.aura =      checkForNull('Aura', parent);
                myData.weaknesses = checkForNull('Weaknesses', parent);
                myData.SQ =        checkForNull('SQ', parent);
                myData.languages = checkForNull('Languages', parent);
                myData.space =     checkForNull('Space', parent);
                myData.reach =     checkForNull('Reach', parent);
                myData.CMD =       checkForNull('CMD', parent);
                myData.CMB =       checkForNull('CMB', parent);
                myData.CMB =       checkForNull('CMB', parent);
                myData.defensiveAbilities = checkForNull('DefensiveAbilities', parent);

                break;
            }
        }
    })

    await fetch('dbFiles/BestiaryDetails.json')
    .then(res => res.json())
    .then(data => {

        for (let elem of data) {
            elem = JSON.parse(JSON.stringify(elem));

            if (elem.ID.toString() === id.toString()) {
                myData.feats = elem.Feats;
                myData.specialAttacks = elem.SpecialAttacks;
                myData.specialAbilities = alterString(elem.SpecialAbilities);
                break;
            }
        }
    })

    return myData;
}

// editing the SpecialAbilities string, putting spaces into it and adding color
function alterString(str) {
    if (str) {
        return str.replace(/[A-Za-z -']*\(Ex\)/gi, '<br><br><span class="abilities">$&</span><br><br>')
                  .replace(/[A-Za-z -']*\(Su\)/gi, '<br><br><span class="abilities">$&</span><br><br>')
                  .replace(/[A-Za-z -']*\(Sp\)/gi, '<br><br><span class="abilities">$&</span><br><br>');
    }
    return null;
}

function decipherString(parent, attackType) {

    function nullCheckWeapon(elem) {
        return elem !== null ? elem[0].trim() : null  
    }

    function nullCheckBrackets(elem) {
        return elem !== null ? elem[1].trim() : null  
    }

    // Checking if this monster has melee or ranged attacks
    if (!parent.querySelector(attackType))  return [{}];
  
    let res = [];
    let originalString = parent.querySelector(attackType).innerHTML;

    let splitByOr = originalString.split(') or '); // to avoid splitting strings like "alchemical or silver dagger +2"
    let splitByComa = splitByOr[0].split('),').filter(e => e ? e : 0);
    let trimmedArr = splitByComa.map(e => e.trim()); 

    // Each str is one attack string
    for (let str of trimmedArr) {

        let data = {};
        let weaponPart = str.match(/^([a-z0-9-+'\/ *]*)/i)[0].replace('*','').trim();
        let inBrackets = str.match(/(\(.[^)]*\)?)/i)[0].trim();

        // Weapon part

        data.numOfAttacks = nullCheckWeapon(weaponPart.match(/^\d+/));
        data.weaponName = weaponPart.match(/[a-z'-]*/gi)
                        .filter(word => word ? word : 0)
                        .join(' ')
                        .trim();

        // Checking if the monster is a swarm or a troop

        if (!isSwarmOrTroop(data.weaponName)) {
  
            let toHitMatch = / [-+0-9\/]+|[+-][\d ]+touch/gi;
            data.toHit = nullCheckWeapon(weaponPart.match(toHitMatch)).replace('touch', '').trim();
        }

        // Bracket part

        data.damage = nullCheckBrackets(inBrackets.match(/^\(([0-9]+d\d+[+-]?\d*)/i));
        data.critRange = nullCheckBrackets(inBrackets.match(/\/(\d+-[\d ]+)/i));
        data.critMod = nullCheckBrackets(inBrackets.match(/\/(x\d)/i));

        let bonusMatch = inBrackets.match(/(x3\/.*)|( [a-z0-9]*)|^\(?([a-z]+)/gi);
        data.bonusInfo = (bonusMatch !== null ? bonusMatch.filter(e => e ? e : 0)
                                                          .join('')
                                                          .trim()
                                                          .replace('(', '')
                                                          .replace(')', '') : null);
        
        res.push(data);
    }

    return res;

}

function isSwarmOrTroop(str) { 
    return str.includes('swarm') || str.includes('troop');      
}

init();


// SUPPLEMENTARY FUNCTIONS

function createRemoveBtn(which='player') {

    let div = document.createElement('div');

    if (which === 'monster') {
        div.classList.add('closeBtn');
    } else {
        div.classList.add('removeBtn');
    }
    
    div.addEventListener('click', function() {
        this.parentNode.remove();
    })

    return div;
}

function removePlayerListener() {
    let removeBtns = document.querySelectorAll('.removeBtn');
    removeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentNode.remove();
            setPlayerNumberToRoot();
        });
    })
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addSearchListener() {

    let searchBar = document.querySelector(".searchBar");
    let monsters = document.querySelector('.monsterList').children;

    // Searches for a string in the monster database (e.g. "goblin")
    searchBar.addEventListener('keypress', function(e) {

        if (e.key === 'Enter') {
            for (let monster of monsters) {
                monster.classList.remove('hidden');

                let monsterStr = monster.innerHTML.toLowerCase();
                let searchedStr = searchBar.value.toLowerCase();
    
                if (monsterStr.indexOf(searchedStr) === -1) {
                    monster.classList.toggle('hidden');
                }
            }
        }
    })
}

function decipherCritRange(str) {

    switch(str) {
        case '15-20': return [15,16,17,18,19,20];
        case '16-20': return [16,17,18.19,20];
        case '17-20': return [17,18,19,20];
        case '18-20': return [18,19,20];
             default: return [19, 20];
    }
}

function decipherSavingThrows(parent) {
    
    let fort = parseInt(parent.querySelector('Fort').innerHTML);
    let ref = parseInt(parent.querySelector('Ref').innerHTML);
    let will = parseInt(parent.querySelector('Will').innerHTML);

    return {fort, ref, will};
}

function clearMonsterBgColors() {
    let fSets = document.querySelectorAll('.monsterShort');
    for (let elem of fSets) {
        elem.classList.remove('darkBlue');
    }
}

function calculateDamage(str) {

    if (str === null) return 0;

    str = str.trim();
    let m = str.match(/(\d+d\d+)([+-])?(\d+)?/i);
    let baseDmg = m[1];
    let operator = m[2];
    let additionalDmg = +m[3];
    
    // Deciphering XdY (1d8, 2d6 etc)

    let dmg = baseDmg.split('d');
    let start = +dmg[0];
    let end = +dmg[1];
    let randomNum = getRandomInt(start, start * end);

    switch(operator) {
        case '+': return randomNum + additionalDmg;
        case '-': return randomNum - additionalDmg;
         default: return randomNum;
    }
}

function deselectAllPlayers() {
    let AC = document.querySelectorAll('.AC');
    
    AC.forEach(e => { // removing color from another chosen element
        e.setAttribute("chosen", "false");   
        e.parentNode.classList.remove('blue');
        e.classList.remove('blue');
    })

}

function choosePlayer(e) {

    deselectAllPlayers();
    let elem = e.target;

    if (elem.classList.contains('AC')) {
        // elem.parentNode.classList.toggle('blue');
        
        elem.setAttribute("chosen", "true");
        elem.classList.toggle('blue');
    }
}

function choosePlayerListener() {
    
    let AC = document.querySelectorAll('.AC');
    
    for (let elem of AC) {
        elem.addEventListener('click', choosePlayer);
    }
}

function getPlayerAC() {

    let AC = document.querySelectorAll('.AC');

    for (let elem of AC) {
        if (elem.getAttribute("chosen") === "true"){
            let bonusToAC = math.evaluate(elem.parentNode.children[4].value);
            let currentAC = +elem.value;
            return bonusToAC ? currentAC + bonusToAC : currentAC;
        }
    }
}

function createMonsterTitle(name) {
    
    let div = document.createElement('div');
    div.classList.add('monsterName');
    div.innerHTML = name;

    let legend = document.createElement('legend');
    legend.appendChild(div);

    return legend;
}


function createInput(value, name) {

    let div = document.createElement('div');
    let inp = document.createElement("input");
    inp.setAttribute("type", "text");
    inp.setAttribute("value", value);

    if (name === 'hp') {
        div.classList.add("div-HP")
        inp.classList.add("monsterHP");
        div.setAttribute("data-tooltip", 'HP');
        
    }

    if (name === 'AC') {
        div.classList.add("div-AC")
        inp.classList.add("monsterAC");
        div.setAttribute("data-tooltip", 'AC');
    }

    div.appendChild(inp);

    return div;
}

// a div inside monsterShort fieldset
function createFirstDataField(obj) {

    let div = document.createElement('div');
    div.classList.add('firstLine');

    div.appendChild(createInput(obj.hp, 'hp'));
    div.appendChild(createInput(obj.AC, 'AC'));
    div.appendChild(createSavingThrowBtn(obj.savingThrows.fort, 'fort'));
    div.appendChild(createSavingThrowBtn(obj.savingThrows.ref, 'ref'));
    div.appendChild(createSavingThrowBtn(obj.savingThrows.will, 'will'));
    div.appendChild(createCMBBtn(obj.CMB));
    
    let sneakDamage = decodeSneakAttack(obj.specialAttacks);
    if (sneakDamage) {
        div.appendChild(createSneakAttackBtn(sneakDamage));
    }
    return div;
}

function decodeSneakAttack(str) {
 
    if (str === null) return null;
    let matched = str.match(/sneak attack (\+\d+d\d+)|\((\+\d+d\d+)\)/i); //( plus \d+ [a-zA-z]+)
    if (matched === null) return null;
 
    console.log(matched);
    console.log(matched[1]);
    let diceDamage = matched[1];
    return calculateDamage(diceDamage);

}

function createSneakAttackBtn(str) {

    let div = document.createElement('div');
    div.classList.add('sneakAttack');
    div.setAttribute("data-tooltip", 'Sneak Attack');

    div.addEventListener('click', function(e) {
        e.target.classList.toggle('sneaky');

    })
    return div;
}

function createAttackDataField(object, attackType) {
    
    let div = document.createElement('div');
    div.classList.add('attackLine');

    let specialAttacks = object.specialAttacks;
    let fullAttackObject = attackType === 'Melee' ? object.melee : object.ranged;
    let arr = Array.from(fullAttackObject);

    for (let obj of arr) {

        // attack string has several attacks (2 claws 1d6+1)
        if (obj.numOfAttacks !== null) {
            for (let i = 0; i < obj.numOfAttacks; i++) {
                div.appendChild(createAttackBtns(obj, attackType, specialAttacks));
            }   

        } else if (isSwarmOrTroop(obj.weaponName) || obj.toHit.split('/').length === 1) {
            div.appendChild(createAttackBtns(obj, attackType, specialAttacks));
        
        // attack string has several attacks of one type with variable toHit (longsword +10/+5) 
        } else {
           for (let i = 0; i < obj.toHit.split('/').length; i++) {
            div.appendChild(createAttackBtns(obj, attackType, specialAttacks, i)); // we need "i" to iterate through hits +15/+10/+5 etc/
           }
        }
    }
    
    return div;
}

function clearResults() {
    let results = document.querySelectorAll('.details');
    for (let res of results) {
        res.innerHTML = '';
    }
}

function createSavingThrowBtn(bonus, saveType) {

    let div = document.createElement("div");
    div.classList.add("rollSavingThrow");

    let saveName = getSaveName(saveType);

    div.id = saveType;
    div.setAttribute("data-tooltip", saveName);
    div.addEventListener('click', function(e) {
        e.stopImmediatePropagation();
        d20Roll(saveName, bonus);
    });

    return div;
}

function getSaveName(type) {
    switch(type) {
        case 'fort': return 'Fortitude';
        case 'ref':  return 'Reflex';
        case 'will': return 'Will';
        default: console.log('Some issue with this saving throw');
    }

}

function createCMBBtn(str) {
    let actionName = 'baseCMB';
    let capitalized = capitalize(actionName);
    let bonus = decipherCMBString(str);

    let div = document.createElement("div");
    div.classList.add(actionName);
    div.setAttribute("data-tooltip", capitalized);

    div.addEventListener('click', function(e) {
        e.stopImmediatePropagation();
        d20Roll('Roll CMB', bonus);
    });

    return div;
}

function decipherCMBString(str) {
    return str.match(/[+-]\d+/i) ? +str.match(/[+-]\d+/i) : 0;
}

function d20Roll(type, bonus) {
    let randomRoll = getRandomInt(1,20);
 
    if (randomRoll === 1)  return rolledNat1(type);
    if (randomRoll === 20) return rolledNat20(type);
                           return otherRoll(type, bonus, randomRoll);
}

function rolledNat1(type) {
    clearResults();
    let res = document.querySelector('.damageDetails');
    res.innerHTML = `${type}: Fail! Natural 1!`;
}

function rolledNat20(type) {
    clearResults();
    let res = document.querySelector('.damageDetails');
    res.innerHTML = `${type}: Success! Natural 20!`;
}

function otherRoll(type, bonus, randomRoll) {
    clearResults();
    let res = document.querySelector('.damageDetails');
    res.innerHTML = `${type}: ${randomRoll} + ${bonus} = ${randomRoll + bonus}`;
}

// SUPPLEMENTARY FUNCTIONS
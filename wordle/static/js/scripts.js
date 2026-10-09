function apiURL(endpoint) {
    const BASE_URL = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return `${BASE_URL}${endpoint}`;
}


// ======================================================================
//  API FETCH FUNCTIONS
// ======================================================================

/**
 * Submits the player's guess to the server
 */
function submitGuess() {
    // Construct guess string from current row tiles
    let guess = '';
    const rowTiles = document.querySelectorAll(`[id^='${current_row}-']`);
    rowTiles.forEach(tile => {
        guess += tile.textContent;
    });
    
    // Validate game state and guess
    if (game_over || has_won) {
        return;
    }
    
    if (guess.length !== 5) {
        shakeRow();
        return;
    }

    // Send guess to server
    console.log('Submitting guess to server:', guess);
    fetch(apiURL('/api/player-guess'), {
        method: 'POST',
        body: JSON.stringify(guess),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            console.error(`Guess submission failed (status: ${response.status})`);
            return;
        }
        return response.json();
    })
    .then(data => {
        updateGame(data);
    })
    .catch(error => {
        console.error('Error submitting guess:', error);
    });
}

/**
 * Fetches current game state from server
 */
function fetchGame() {
    console.log('Fetching game state from server...');
    fetch(apiURL('/api/sync-game'), {
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            console.error(`Failed to fetch game state (status: ${response.status})`);
            return;
        }
        return response.json();
    })
    .then(data => {
        updateGame(data);
    })
    .catch(error => {
        console.error('Error fetching game state:', error);
    });
}

/**
 * Fetches player statistics from server
 */
function fetchStats() {
    console.log('Fetching stats from server...');
    fetch(apiURL('/api/sync-stats'), {
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            console.error(`Failed to fetch stats (status: ${response.status})`);
            return;
        }
        return response.json();
    })
    .then(data => {
        updateStats(data);
    })
    .catch(error => {
        console.error('Error fetching stats:', error);
    });
}

/**
 * Resets the game state on server
 */
function resetGame() {
    fetch(apiURL('/api/reset-game'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            console.error('Failed to reset game');
            return;
        }
        return response.json();
    })
    .then(() => {
        window.location.reload();
    })
    .catch(error => {
        console.error('Error resetting game:', error);
    });
}


// ======================================================================
//  CLIENT-SIDE GAME VARIABLES
// ======================================================================

// Game State
var target_word;
var current_row;
var game_over;
var has_won;

// Game Boards
var matrix = [];       // Stores all player guesses (5x6 grid)
var eval_matrix = [];  // Stores evaluation states for each guessed letter

// Keyboard Tracking
var used_letters;       // Tracks all letters that have been used
var eval_used_letters;  // Tracks letters with known evaluation states

// DOM Elements
var all_tiles;
var all_keys;

// Statistics
var current_streak;
var longest_streak;
var guess_distribution;

// Game Metrics
var games_total;
var games_won;
var games_lost;
var win_percentage = 0;
var guesses_average;

// UI State
var selected;
var just_loaded = true;

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    all_tiles = document.querySelectorAll('.tile');
    all_keys = document.querySelectorAll('.key');
    
    // Initialize game state
    fetchGame();
});


// ======================================================================
//  READ AND PROCESS SERVER DATA FUNCTIONS
// ======================================================================

function updateGame(data) {
    // Update core game state from server data
    let was_valid = matrix.length < data.guess_matrix.length;
    target_word = data.target_word;
    matrix = data.guess_matrix;
    eval_matrix = data.evaluation_matrix;
    has_won = data.has_won;
    
    // Process the updated game state
    processGameUpdate(was_valid);
}

function processGameUpdate(was_valid) {
    // Determine game over state
    game_over = matrix.length >= 6 && !has_won;
    current_row = matrix.length;

    // Update tracked letters
    updateUsedLetters();

    // Handle initial load
    if (just_loaded) {
        updateGridText();
        updateGridColors();
        updateKeyboardColors();
    } else {
        if (was_valid) {
            rowRevealAnimation(has_won || game_over);
        } else {
            shakeRow();
        }
    }

    // Handle game completion
    if (has_won || game_over) {
        if (just_loaded) {
            openPopup();
        }
    } else {
        if (was_valid || just_loaded) {
            selected = document.getElementById(`${current_row}-0`);
        }
        updateCurrentRow();
        updateSelected();
    }
    
    just_loaded = false;
}

function updateStats(data) {
    // Update statistics from server data
    current_streak = data.current_streak;
    longest_streak = data.longest_streak;
    guess_distribution = data.guess_distribution;
    
    // Process the updated statistics
    processStatsUpdate();
}

function processStatsUpdate() {
    // Calculate game totals
    games_total = guess_distribution.reduce((total, current) => total + current, 0);
    games_lost = guess_distribution[6];
    games_won = games_total - games_lost;
    
    // Calculate win percentage
    win_percentage = 0;
    if (games_won !== 0) {
        win_percentage = Math.round(100 * games_won / games_total);
    }
    
    // Calculate average guesses for wins
    guesses_average = 0;
    for (let i = 0; i < guess_distribution.length - 1; i++) {
        guesses_average += i * guess_distribution[i];
    }
    if (games_won !== 0) {
        guesses_average = guesses_average / games_won + 1;
        guesses_average = guesses_average.toFixed(1);
    }

    // Update the statistics popup
    updatePopup();
}


// ======================================================================
//  HELPER UPDATE FUNCTIONS
// ======================================================================

function updateGridText() {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < 5; x++) {
            const tile = document.getElementById(`${y}-${x}`);
            tile.textContent = matrix[y][x];
        }
    }
}

function updateGridColors() {
    eval_matrix.forEach((row, y) => {
        row.slice(0, 5).forEach((colorindex, x) => {
            const tile = document.getElementById(`${y}-${x}`);
            tile.classList.remove("yellow", "green", "grey");
            tile.classList.add(
                colorindex === 1 ? "yellow" : 
                colorindex === 2 ? "green" : "grey"
            );
        });
    });
}

function updateUsedLetters() {
    const letterMap = new Map();
    
    matrix.forEach((row, y) => {
        row.slice(0, 5).forEach((letter, x) => {
            const evaluate = eval_matrix[y][x];
            if (!letterMap.has(letter)) {
                letterMap.set(letter, evaluate);
            } else if (evaluate > letterMap.get(letter)) {
                letterMap.set(letter, evaluate);
            }
        });
    });
    
    used_letters = Array.from(letterMap.keys());
    eval_used_letters = Array.from(letterMap.values());
}

function updateKeyboardColors() {
    // Reset all keys
    all_keys.forEach(key => key.className = 'key');
    
    // Add special class to special keys
    document.querySelectorAll('[id^="special-"]').forEach(key => {
        key.classList.add('special');
    });
    
    // Color used keys based on evaluation
    used_letters.forEach((letter, i) => {
        const key = document.getElementById(letter);
        if (!key) return;
        
        key.classList.add(
            eval_used_letters[i] === 1 ? "yellow" :
            eval_used_letters[i] === 2 ? "green" : "grey"
        );
    });
}

function updateCurrentRow() {
    all_tiles.forEach(tile => tile.classList.remove('current_row'));
    document.querySelectorAll(`[id^="${current_row}-"]`).forEach(tile => {
        tile.classList.add('current_row');
    });
}

function updateSelected() {
    document.querySelectorAll(`[id^="${current_row}-"]`).forEach(tile => {
        tile.classList.remove('selected');
    });
    selected?.classList.add('selected');
}

function updatePopup() {
    // Update heading based on game state
    const heading = document.getElementById('heading');
    heading.textContent = has_won ? 'Congrats!' : game_over ? 'Game Over!' : 'Statistics:';

    // Game outcome messages
    const messages = {
        1: `Are you cheating? The word was: <span class="span-reveal">${target_word}</span>. How did you get that first Try? Maybe you should start playing the Lottery!`,
        2: `Not bad! You nailed it in two tries. The word was: <span class="span-reveal">${target_word}</span>. Who needs a crystal ball when you have such skills?`,
        3: `Third time's the charm! You figured it out. The word was: <span class="span-reveal">${target_word}</span>. Did you secretly peek at the dictionary?`,
        4: `Four tries? Impressive! You cracked it. The word was: <span class="span-reveal">${target_word}</span>. Feels like a victory, but you still have room for improvement!`,
        5: `Fifth try and you're still going strong! You got it. The word was: <span class="span-reveal">${target_word}</span>. Well, better late than never, right?`,
        6: `Sixth try! You finally did it. The word was: <span class="span-reveal">${target_word}</span>. It may have taken a while, but hey, you got it!`,
        7: `Oh! Seems like you had no luck this time! The word was: <span class="span-reveal">${target_word}</span>. Don't worry, you'll get it next time… Maybe.`,
        default: `Here's a breakdown of your Wordle performance, keep playing and you will see improvement in no time! Thanks for playing!`,
    };

    // Set feedback message
    const feedback = document.getElementById('feedback');
    feedback.innerHTML = has_won ? (messages[current_row] || messages.default) : 
                       game_over ? messages[7] : messages.default;

    // Show/hide reset button
    const key_reset = document.getElementById('key-reset');
    key_reset.style.display = (has_won || game_over) ? 'flex' : 'none';

    // Update numeric stats
    const elements = {
        'games-total': games_total,
        'win-percentage': `${win_percentage}%`,
        'current-winstreak': current_streak,
        'longest-winstreak': longest_streak
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        document.getElementById(id).textContent = value;
    });

    // Update bar chart
    document.getElementById('guesses-average').textContent = guesses_average;
    
    guess_distribution.slice(0, -1).forEach((value, i) => {
        const percentage = games_won ? (100 * value / games_won) : 0;
        const bar = document.getElementById(`bar-${i}`);
        bar.style.width = `${percentage}%`;
        document.getElementById(`bar-value-${i}`).textContent = value;
    });
}


// ======================================================================
//  INPUT HANDLING FUNCTIONS
// ======================================================================

function pressedLetter(letter) {
    if (has_won || game_over) return;
    if (!selected) {
        shakeRow();
    } else {
        selected.textContent = letter;
        const x_val = parseInt(selected.id[2]) + 1;
        
        tileInputAnimation(selected);
        
        if (x_val >= 0 && x_val <= 4) {
            selected = document.getElementById(`${current_row}-${x_val}`);
        } else {
            selected = null;
        }
    }
    updateSelected();
}

function pressedBackspace() {
    if (has_won || game_over) return;
    if (!selected) {
        selected = document.getElementById(`${current_row}-4`);
        selected.textContent = '';
    } else if (selected.textContent != '') {
        selected.textContent = '';
    } else {
        const x_val = Math.max(parseInt(selected.id[2]) - 1, 0);
        selected = document.getElementById(`${current_row}-${x_val}`);
        selected.textContent = '';
    }
    updateSelected();
}

function pressedEnter() {
    if ((game_over || has_won) && popup_is_open) {
        resetGame();
    } else {
        submitGuess();
    }
}

function pressedRightArrow() {
    if (has_won || game_over) return;
    if (!selected) return;

    const x_val = parseInt(selected.id[2]);
    if (x_val >= 0 && x_val <= 3) {
        selected = document.getElementById(`${current_row}-${x_val+1}`);
    }
    updateSelected();
}

function pressedLeftArrow() {
    if (has_won || game_over) return;
    if (!selected) return;

    const x_val = parseInt(selected.id[2]); 
    if (x_val >= 1 && x_val <= 4) {
        selected = document.getElementById(`${current_row}-${x_val-1}`);
    }
    updateSelected();
}


// ======================================================================
//  EVENT HANDLERS
// ======================================================================
let key_state = {};

// Handle keyboard key presses
document.addEventListener('keydown', (event) => {
    const letter = event.key.toUpperCase();
    
    if (!key_state[event.key]) {
        key_state[event.key] = true;
        
        switch (event.key) {
            case 'Enter':
                document.getElementById('special-enter').classList.add('active');
                pressedEnter();
                break;
                
            case 'Backspace':
                document.getElementById('special-backspace').classList.add('active');
                pressedBackspace();
                break;

            case 'ArrowRight':
                pressedRightArrow();
                break;
            
            case 'ArrowLeft':
                pressedLeftArrow();
                break;
                
            default:
                if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
                    document.getElementById(letter).classList.add('active');
                    pressedLetter(letter);
                }
                break;
        }
    }
});

// Handle keyboard key releases
document.addEventListener('keyup', (event) => {
    const letter = event.key.toUpperCase();
    key_state[event.key] = false;
    
    switch (event.key) {
        case 'Enter':
            document.getElementById('special-enter').classList.remove('active');
            break;
            
        case 'Backspace':
            document.getElementById('special-backspace').classList.remove('active');
            break;
            
        default:
            if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
                document.getElementById(letter).classList.remove('active');
            }
            break;
    }
});

// Handle mouse clicks
document.addEventListener('mousedown', (event) => {
    if (event.button === 0) {  // Left mouse button only
        const tile = document.querySelector('.current_row:hover');
        const key = document.querySelector('.key:hover');
        
        if (tile) {
            if (has_won || game_over) return;
            selected = tile;
            updateSelected();
        } else if (key) {
            switch (key.id) {
                case 'special-backspace':
                    pressedBackspace();
                    break;
                    
                case 'special-enter':
                    pressedEnter();
                    break;
                    
                default:
                    pressedLetter(key.id);
                    break;
            }
        }
    }
});


// ======================================================================
//  ANIMATION FUNCTIONS
// ======================================================================
let is_shaking = false;
let popup_is_open = false;

function shakeRow() {
    if (!has_won && !game_over && !is_shaking) {
        is_shaking = true;

        const elements = document.querySelectorAll('.current_row');
        elements.forEach(element => {
            // Apply shake animation
            element.style.animation = 'shake 0.5s ease-in-out';

            // Clean up after animation
            setTimeout(() => {
                element.style.animation = '';
                is_shaking = false;
            }, 500);
        });
    }
}

function tileInputAnimation(tile) {
    // Quick scale animation for key presses
    tile.style.transform = "scale(1)";
    
    setTimeout(() => {
        tile.style.transform = "scale(1.1)";
        
        setTimeout(() => {
            tile.style.transform = "scale(1)";
        }, 50);
    }, 20);
}

function rowRevealAnimation(open_popup, specificRow = null) {
    const ANIMATION_DELAY = 200;
    const row = specificRow !== null ? specificRow : current_row - 1;
    
    // Get all tiles for the target row
    const tiles = [];
    for (let i = 0; i < 5; i++) {
        const tile = document.getElementById(`${row}-${i}`);
        if (tile) tiles.push(tile);
    }

    // Animate each tile sequentially
    tiles.forEach((tile, i) => {
        if (!tile) return;

        tile.style.transition = "transform 0.2s ease";
        
        setTimeout(() => {
            // First half of flip animation
            tile.style.transform = 'rotateY(90deg)';
            
            setTimeout(() => {
                // Second half with color reveal
                const colorIndex = eval_matrix[row][i];
                tile.style.transform = 'rotateY(0deg)';
                tile.classList.add(
                    colorIndex === 2 ? 'green' : 
                    colorIndex === 1 ? 'yellow' : 'grey'
                );

                // Update keyboard colors
                const letter = tile.textContent;
                const key = document.getElementById(letter);
                if (!key) return;

                // Only upgrade key color (green > yellow > grey)
                if (colorIndex === 2) {
                    key.classList.add('green');
                    key.classList.remove('yellow', 'grey');
                } else if (colorIndex === 1 && !key.classList.contains('green')) {
                    key.classList.add('yellow');
                    key.classList.remove('grey');
                } else if (colorIndex === 0 && 
                        !key.classList.contains('green') && 
                        !key.classList.contains('yellow')) {
                    key.classList.add('grey');
                }
            }, ANIMATION_DELAY);
        }, i * ANIMATION_DELAY * 2);
    });

    // Open popup after animations complete if needed
    if (open_popup) {
        const totalDelay = (5 * ANIMATION_DELAY * 2) + ANIMATION_DELAY;
        setTimeout(openPopup, totalDelay);
    }
}

function openPopup() {
    fetchStats();

    const popup = document.querySelector('.popup');
    const overlay = document.querySelector('.overlay');
    
    // Initial hidden state
    popup.style.transform = 'translateY(50%)';
    popup.style.opacity = '0';
    popup.style.transition = 'none';
    
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    
    // Trigger reflow
    void popup.offsetHeight;
    
    // Animate in
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity = '1';
    popup.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
    popup.style.transform = 'translateY(0)';
    popup.style.opacity = '1';
    popup_is_open = true;
}

function closePopup() {
    const popup = document.querySelector('.popup');
    const overlay = document.querySelector('.overlay');

    // Set transitions
    popup.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
    overlay.style.transition = 'opacity 0.5s ease';

    // Animate out
    popup.style.transform = 'translateY(50%)';
    popup.style.opacity = '0';
    overlay.style.opacity = '0';

    // Clean up after animation
    const cleanUp = () => {
        overlay.style.display = 'none';
        popup.style.transition = 'none';
        popup.style.transform = 'translateY(50%)';
        popup.style.opacity = '0';
        
        // Remove listeners
        popup.removeEventListener('transitionend', cleanUp);
        overlay.removeEventListener('transitionend', cleanUp);
    };

    popup.addEventListener('transitionend', cleanUp, { once: true });
    overlay.addEventListener('transitionend', cleanUp, { once: true });
    popup_is_open = false;
}
# marlin.laja@gmx.de - 03/2025
from flask import Flask, request, jsonify, render_template, abort, session
from functions import *


app = Flask(__name__)
app.secret_key = 'THIS_IS_A_VERY_SECRET_KEY'


# ======================================================================
#  MAIN ROUTE - Serves the frontend and initializes game session
# ======================================================================
@app.route('/')
def index():
    
    # Initialize session statistics if they don't exist
    if 'stats' not in session:
        reset_stats(internal_call=True)
    
    # Initialize game state if it doesn't exist
    if 'game' not in session:
        reset_game(internal_call=True)
    
    # Render the main game page
    return render_template('index.html')


# ======================================================================
#  MAKE GUESS - Processes player's word guess
# ======================================================================
@app.route('/api/player-guess', methods=['POST'])
def player_guess():

    if not request.is_json:
        abort(403)

    guess = request.get_json()
    print("GUESS DATA:", guess)

    process_player_guess(session, guess)

    return sync_game(is_internal_call=True)


# ======================================================================
#  SYNC GAMESTATE - Returns current game state to frontend
# ======================================================================
@app.route('/api/sync-game', methods=['GET'])
def sync_game(is_internal_call=False):
    
    # Only accept JSON requests if called externally
    if not is_internal_call and not request.is_json:
        abort(403)  # Forbidden
        
    # Get current game state from session
    game = session['game']
    
    # Prepare response with game data
    gamestate_response = {
        'target_word': None,
        'guess_matrix': game['guess_matrix'],
        'evaluation_matrix': game['evaluation_matrix'],
        'has_won': game['has_won']
    }
            
    # Reveal target word if game is over
    if game['has_won'] or game['game_over']:
        gamestate_response['target_word'] = game['target_word']

    return jsonify(gamestate_response)


# ======================================================================
#  SYNC STATISTICS - Returns current player statistics
# ======================================================================
@app.route('/api/sync-stats', methods=['GET'])
def sync_stats(internal_call=False):
    
    # Only accept JSON requests if called externally
    if not internal_call and not request.is_json:
        abort(403)  # Forbidden

    # Get current stats from session
    stats = session['stats']
    
    # Prepare response with statistics
    stats_response = {
        'current_streak': stats['current_streak'],
        'longest_streak': stats['longest_streak'],
        'guess_distribution': stats['guess_distribution']
    }

    return jsonify(stats_response)


# ======================================================================
#  RESET GAMESTATE - Starts a new game with fresh word
# ======================================================================
@app.route('/api/reset-game', methods=['POST'])
def reset_game(internal_call=False):
    
    # Only accept JSON requests if called externally
    if not internal_call and not request.is_json:
        abort(403)  # Forbidden

    # Create new game state with random target word
    game = {
        'target_word': random_word(),
        'guess_matrix': [],
        'evaluation_matrix': [],
        'game_over': False,
        'has_won': False
    }
    
    # Store new game state in session
    session['game'] = game
    print('Searching: ' + game['target_word'])

    return jsonify({'status': 'success'})


# ======================================================================
#  RESET STATISTICS - Clears all player statistics
# ======================================================================
@app.route('/api/reset-stats', methods=['POST'])
def reset_stats(internal_call=False):
    
    # Only accept JSON requests if called externally
    if not internal_call and not request.is_json:
        abort(403)  # Forbidden

    # Create clean statistics
    stats = {
        'current_streak': 0,
        'longest_streak': 0,
        'guess_distribution': [0, 0, 0, 0, 0, 0, 0]
    }
    
    # Store new stats in session
    session['stats'] = stats
    
    return jsonify({'status': 'success'})


if __name__ == '__main__':
    app.run(debug=False)
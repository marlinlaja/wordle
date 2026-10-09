import random
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ======================================================================
#  WORD SELECTION - Randomly selects a target word from file
# ======================================================================
def random_word():
    with open(os.path.join(BASE_DIR, 'dictionary', 'game_list.txt'), 'r') as file:
        # Initialize variables
        word = None
        count = 0
        
        # Reservoir sampling to select random word efficiently
        for line in file:
            count += 1
            if random.randint(1, count) == 1:
                word = line.strip()

    return word


# ======================================================================
#  DICTIONARY CHECK - Validates if word exists in dictionary
# ======================================================================
def is_in_dictionary(guess):
    with open(os.path.join(BASE_DIR, 'dictionary', 'word_list.txt'), 'r') as file:
        for line in file:
            if line.strip() == guess:
                return True
    return False


# ======================================================================
#  PROCESS GUESS - Handles player's guess and updates game state
# ======================================================================
def process_player_guess(session, guess):
    game = session['game']
    stats = session['stats']

    # Validate guess against dictionary
    if not is_in_dictionary(guess):
        return False

    # Append guess to game matrix
    guess_list = list(guess)
    game['guess_matrix'].append(guess_list)

    # Evaluate guess against target word
    guess_eval = evaluate_guess(guess, game['target_word'])
    game['evaluation_matrix'].append(guess_eval)

    # Update game status
    has_won = guess == game['target_word']
    game_over = len(game['guess_matrix']) >= 6 and not has_won
    game['has_won'] = has_won
    game['game_over'] = game_over

    # Update statistics
    update_stats(stats, game, has_won, game_over)

    # Persist changes to session
    session['game'] = game
    session['stats'] = stats
    
    return True


# ======================================================================
#  EVALUATE GUESS - Compares guess against target word
# ======================================================================
def evaluate_guess(guess, target_word):
    guess_list = list(guess)
    target_list = list(target_word)
    evaluation = [0, 0, 0, 0, 0]  # Initialize all letters as incorrect

    # First pass: Check for exact matches (correct letter and position)
    for i in range(len(guess_list)):
        if guess_list[i] == target_list[i]:
            evaluation[i] = 2  # Mark as correct position
            target_list[i] = None  # Remove from further checks

    # Second pass: Check for correct letters in wrong positions
    for i in range(len(guess_list)):
        if evaluation[i] == 0:  # Only check letters not already marked correct
            if guess_list[i] in target_list:
                index = target_list.index(guess_list[i])
                evaluation[i] = 1  # Mark as correct letter wrong position
                target_list[index] = None  # Mark as used
    
    return evaluation


# ======================================================================
#  UPDATE STATS - Handles win/loss statistics tracking
# ======================================================================
def update_stats(stats, game, has_won, game_over):
    if game_over:
        # Track failed attempts in the last bin
        stats['guess_distribution'][6] += 1
        stats['current_streak'] = 0
    elif has_won:
        # Track successful attempts by guess count
        attempts = len(game['guess_matrix']) - 1
        stats['guess_distribution'][attempts] += 1
        stats['current_streak'] += 1
        
        # Update longest win streak if needed
        if stats['longest_streak'] < stats['current_streak']:
            stats['longest_streak'] = stats['current_streak']
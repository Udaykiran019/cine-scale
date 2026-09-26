1"""
prepare_data.py
Cleans and filters Indian movies dataset for the 'Higher or Lower' movie rating game.

Task 1: Data Cleaning & Filtering
- Keeps only 'Name', 'Year', 'Rating', and 'Votes' columns.
- Drops 'Duration', 'Genre', 'Director', 'Actor 1', 'Actor 2', 'Actor 3' columns.
- Filters out movies with fewer than 5,000 votes (retaining popular, recognizable films).
"""

import argparse
import sys
import pandas as pd


def prepare_movie_data(input_path: str, output_path: str, keep_numeric_votes: bool = True) -> pd.DataFrame:
    print(f"Reading data from: {input_path}")
    # Read with latin1 encoding to handle special characters in titles/names
    df = pd.read_csv(input_path, encoding='latin1')
    initial_count = len(df)
    print(f"Loaded {initial_count} initial records.")

    # 1. Drop unwanted columns: Duration, Genre, Director, Actor 1, Actor 2, Actor 3
    columns_to_drop = ['Duration', 'Genre', 'Director', 'Actor 1', 'Actor 2', 'Actor 3']
    df = df.drop(columns=[col for col in columns_to_drop if col in df.columns], errors='ignore')

    # 2. Keep only Name, Year, Rating, Votes
    target_columns = ['Name', 'Year', 'Rating', 'Votes']
    available_target_cols = [col for col in target_columns if col in df.columns]
    df = df[available_target_cols]

    # 3. Clean 'Votes' column: strip commas and parse to numeric
    # Raw votes can be strings like "6,619" or already numeric
    votes_cleaned = pd.to_numeric(
        df['Votes'].astype(str).str.replace(',', '', regex=False),
        errors='coerce'
    )

    # 4. Filter: Keep only movies with >= 5,000 votes and valid Rating
    valid_mask = (votes_cleaned >= 5000) & df['Rating'].notna() & df['Name'].notna()
    filtered_df = df[valid_mask].copy()

    if keep_numeric_votes:
        filtered_df['Votes'] = votes_cleaned[valid_mask].astype(int)

    # Reset index for clean output
    filtered_df = filtered_df.reset_index(drop=True)

    # Save to output file (using UTF-8 encoding)
    filtered_df.to_csv(output_path, index=False, encoding='utf-8')
    print(f"Filtering complete: {len(filtered_df)} / {initial_count} movies retained.")
    print(f"Cleaned dataset saved to: {output_path}")

    return filtered_df


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Clean and prepare movie data for Higher or Lower game.")
    parser.add_argument('--input', default='data/indian_movies.csv', help="Path to input CSV file")
    parser.add_argument('--output', default='data/cleaned_indian_movies.csv', help="Path to output CSV file")
    parser.add_argument('--in-place', action='store_true', help="Overwrite input file directly (creates a .raw.bak backup first)")

    args = parser.parse_args()

    input_file = args.input
    output_file = args.output

    if args.in_place:
        backup_file = input_file.replace('.csv', '_raw.csv')
        print(f"Backing up original data to {backup_file}...")
        import shutil
        shutil.copyfile(input_file, backup_file)
        output_file = input_file

    prepare_movie_data(input_file, output_file)

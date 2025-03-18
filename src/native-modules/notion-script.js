#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

// This script handles Notion API calls through command line arguments
async function main() {
    try {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.error("Missing command. Use 'query-database' or 'query-stickers'");
            process.exit(1);
        }

        const command = args[0];

        if (command === 'query-database') {
            if (args.length < 3) {
                console.error("Missing arguments. Usage: query-database <api-key> <database-id>");
                process.exit(1);
            }

            const apiKey = args[1];
            const databaseId = args[2];

            // Initialize Notion client
            const notion = new Client({ auth: apiKey });

            // Query database
            const response = await notion.databases.query({
                database_id: databaseId
            });

            // Get additional metadata for stickers
            for (let i = 0; i < response.results.length; i++) {
                const page = response.results[i];

                // Check if there are stickers relation
                const stickersRelation = page.properties.Stickers?.relation || [];

                if (stickersRelation.length > 0) {
                    const stickersData = [];

                    // Fetch each sticker page data
                    for (const sticker of stickersRelation) {
                        try {
                            const stickerPage = await notion.pages.retrieve({ page_id: sticker.id });
                            stickersData.push(stickerPage);
                        } catch (error) {
                            console.error(`Error fetching sticker with ID ${sticker.id}:`, error.message);
                        }
                    }

                    // Add sticker data to the page
                    page.stickersData = stickersData;
                }
            }

            // Output the results as JSON for the parent process to parse
            console.log(JSON.stringify(response.results));
            process.exit(0);
        } else if (command === 'query-sticker') {
            if (args.length < 3) {
                console.error("Missing arguments. Usage: query-sticker <api-key> <sticker-id>");
                process.exit(1);
            }

            const apiKey = args[1];
            const stickerId = args[2];

            // Initialize Notion client
            const notion = new Client({ auth: apiKey });

            // Get sticker page
            const sticker = await notion.pages.retrieve({ page_id: stickerId });

            // Output the sticker as JSON
            console.log(JSON.stringify(sticker));
            process.exit(0);
        } else {
            console.error(`Unknown command: ${command}`);
            process.exit(1);
        }
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

main(); 
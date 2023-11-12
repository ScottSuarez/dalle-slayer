Dalle-slayer is a vampire survivor clone with auto generated graphics from dalle. 

The topics for generation are created from a chatgpt request.

## how to run

npm install

npm run server
npm start

## other dependencies

Note for the server you need python3, opencv-python, and numpy.

This is needed to cut the sprite out and trim it down for game rendering.

### .env

you need an .env file at the root of your directory with your openAI token.
OPENAI_API_KEY=123

Server needs this call dalle and chat gpt.. its pretty cheap though !!

## interesting tidbits
* I pass an SNES title for style alignment. This was kind of a /hack/ to make sure the generated sprites artistically align.
* I ask for the genre in the json response to get some /precognition/ from language model so the characters it suggests fit within. I don't actually /use/ it. 

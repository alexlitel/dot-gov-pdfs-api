#.gov pdfs api
====

This project is API (including web interface for user management/API testing) inspired by my [@govpdfs Twitter bot](https://github.com/alexlitel/dotgovpdfs), which tweets out links to (hopefully) new PDFs on the .gov TLD. Unlike the Twitter bot, which reads a potentially specious Google Reader feed as its source, the API uses a different methodology to extract directly from Google searches to surface a larger quantity of results in a timelier and more accurate manner. For now, I have not deployed a public-facing version of the API, but that may change in the future.

It is designed to be implemented within newsroom or other organizational environments. You'll need to customize the configuration to make it run in your local environment, so you will need some familiarity with NodeJS, MongoDB/Mongoose and the like. To prevent abuse and have some control over where this project is deployed, this repo does not include the actual scraper code, and the `app/scraper.js` file is empty. To request the scraper code or more information, suggest an improvement, or notify me of a scraper-related issue, please [send me a message](mailto://alexlitelATgmailDOTcom). You can also, of course, also file an issue on Github or fork/pull request the project repo. Once you have the scraper code, just git clone or download the project off this page and copy the code into the relevant file.

## Other things
----
* While the web interface could easily run in something like React, I purposely avoided any frameworks to so that there would be no issues in environments where JavaScript may pose an issue (and any AJAX-type behavior could be run server-side).
* The scraper script is designed to be run once daily. By default, it will run at 12:05AM. Feel free to change the time (you may need specify a timezone), but adjusting the frequency of the scraper may affect the script's efficacy.
* You could implement the project on your own servers or using something like Heroku, which I used for testing. Take some precaution in hosting to make sure it doesn't interfere with normal Google usage.
* There is an optional feature (off by default) that allows for role assignment and distribution of new PDFs based on beat et al after the scraper script runs.
* By default, all new users have to be approved by the administrator specified in the config. The config also includes an option to limit new user registration to email addresses on a specific domain.
* This project could probably be a framework for a bunch of other uses. Ostensibly, this might be a more effective form of Google Alerts. Or you could grab the headlines from the Huffington Post once daily and deposit that into a DB.
* You'll need to use Mongoimport or something similiar to import all of the domains from the `data/domainsinfo.json` file, which is a customized dataset of 5,500+ .gov domains that allows the scraper to categorize things effectively.
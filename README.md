<h1>HeyBurrito 🌯</h1>

<h2>1. Purpose of HeyBurrito</h2>
<p><strong>HeyBurrito</strong> is a fun and interactive Slack bot designed to foster positivity, recognition, and team bonding in Slack workspaces. The bot allows users to give "burritos" 🌯 as a token of appreciation to their colleagues by reacting to messages or using slash commands. Each burrito represents gratitude or recognition, and the bot keeps track of the burritos given and received, making it easy to celebrate contributions and build a more engaging workplace culture.</p>

<h3>Key Features:</h3>
<ul>
  <li><strong>Give Burritos with Reactions:</strong> React to messages with the <code>:burrito:</code> emoji to appreciate the original poster.</li>
  <li><strong>Track Statistics:</strong> The bot tracks how many burritos each user has given and received.</li>
  <li><strong>Leaderboard:</strong> See who’s leading in receiving burritos.</li>
  <li><strong>Interactive Messages:</strong> Respond in threads when burritos are given to acknowledge the gesture.</li>
</ul>

<hr />

<h2>2. How to Set Up HeyBurrito</h2>

<h3>Prerequisites</h3>
<ol>
  <li>A working Slack workspace.</li>
  <li>Access to create and configure a Slack App.</li>
  <li>A server with Node.js installed to run the application.</li>
</ol>

<h3>Step 1: Create a Slack App</h3>
<ol>
  <li><strong>Go to the Slack API Portal:</strong>
    <p>Visit <a href="https://api.slack.com/apps" target="_blank">Slack API: Your Apps</a> and log in with your Slack account.</p>
  </li>
  <li><strong>Create a New App:</strong>
    <p>Click on <strong>"Create New App"</strong>. Choose <strong>"From Scratch"</strong>. Enter a name for your app (e.g., <code>HeyBurrito</code>) and select your workspace.</p>
  </li>
  <li><strong>Enable Bot Features:</strong>
    <p>Go to <strong>OAuth &amp; Permissions</strong> and add the following bot token scopes:</p>
    <ul>
      <li><code>commands</code>: To handle slash commands.</li>
      <li><code>reactions:read</code>: To listen for reaction events.</li>
      <li><code>chat:write</code>: To send messages in channels and threads.</li>
      <li><code>users:read</code>: To fetch user information.</li>
    </ul>
  </li>
</ol>

<h3>Step 2: Set Up Event Subscriptions</h3>
<ol>
  <li><strong>Enable Event Subscriptions:</strong>
    <p>Navigate to <strong>Event Subscriptions</strong>. Toggle the switch to enable events.</p>
  </li>
  <li><strong>Set the Request URL:</strong>
    <p>Use a public URL that points to your server’s <code>/slack/events</code> endpoint (e.g., <code>https://yourdomain.com/slack/events</code>).</p>
    <p>During local development, you can use tools like <a href="https://ngrok.com/" target="_blank">ngrok</a> to expose your server:</p>
    <pre><code>ngrok http 3000</code></pre>
    <p>Enter the generated URL: <code>https://&lt;your-ngrok-url&gt;/slack/events</code>.</p>
  </li>
  <li><strong>Subscribe to Bot Events:</strong>
    <p>Add the following events under <strong>Bot Events</strong>:</p>
    <ul>
      <li><code>reaction_added</code>: To listen for reactions like <code>:burrito:</code>.</li>
      <li><code>message.channels</code>: (Optional) To monitor public channel messages.</li>
    </ul>
  </li>
</ol>

<h3>Step 3: Add a Slash Command</h3>
<ol>
  <li><strong>Navigate to Slash Commands:</strong>
    <p>Go to <strong>Slash Commands</strong> and create a new command. Example configuration:</p>
    <ul>
      <li><strong>Command:</strong> <code>/burrito</code></li>
      <li><strong>Request URL:</strong> <code>https://yourdomain.com/slack/commands</code></li>
      <li><strong>Short Description:</strong> "Give a burrito to someone!"</li>
      <li><strong>Usage Hint:</strong> <code>/burrito @user [message]</code></li>
    </ul>
  </li>
  <li><strong>Save and Update:</strong>
    <p>Once saved, the command will be available in your Slack workspace.</p>
  </li>
</ol>

<h3>Step 4: Deploy and Run the Application</h3>
<ol>
  <li><strong>Clone the Repository:</strong>
    <pre><code>git clone https://github.com/AguacateVelarde/heyburrito.git
cd heyburrito</code></pre>
  </li>
  <li><strong>Install Dependencies:</strong>
    <pre><code>npm install</code></pre>
  </li>
  <li><strong>Configure Environment Variables:</strong>
    <p>Create a <code>.env</code> file in the project root with the following content:</p>
    <pre><code>SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
MONGODB_URI=mongodb+srv://your-mongo-uri
PORT=3000</code></pre>
  </li>
  <li><strong>Start the Application:</strong>
    <pre><code>npm run start</code></pre>
  </li>
  <li><strong>Expose the Server:</strong>
    <p>If running locally, expose your server using <a href="https://ngrok.com/" target="_blank">ngrok</a>:</p>
    <pre><code>ngrok http 3000</code></pre>
  </li>
</ol>

<h3>Step 5: Invite the Bot to Your Channels</h3>
<p>Use the <code>/invite</code> command in Slack to invite the bot to a channel.</p>
<pre><code>/invite @HeyBurrito</code></pre>

<h3>Step 6: Test the Bot</h3>
<ol>
  <li><strong>Give a Burrito:</strong>
    <p>React to a message with the <code>:burrito:</code> emoji.</p>
    <p>Verify that the bot increments burritos for the original poster and responds in the thread.</p>
  </li>
  <li><strong>Use Slash Commands:</strong>
    <p>Run <code>/burrito @username Great work on the project!</code></p>
    <p>Check that the bot updates the statistics.</p>
  </li>
  <li><strong>Check the Leaderboard:</strong>
    <p>Run <code>/leaderboard</code> to see the top burrito recipients.</p>
  </li>
</ol>

<hr />

<h2>3. Additional Notes</h2>
<ul>
  <li><strong>Security:</strong> Keep your <code>SLACK_SIGNING_SECRET</code> private and never expose it in public repositories.</li>
  <li><strong>Customization:</strong> Feel free to extend the bot's functionality, such as adding new emoji reactions or custom leaderboards.</li>
  <li><strong>Feedback:</strong> Encourage your team to use the bot regularly to build a positive and engaging environment.</li>
</ul>

<p>Enjoy fostering positivity and recognition with <strong>HeyBurrito</strong>! 🌯</p>

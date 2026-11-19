import './MessagesPage.css';

function MessageGlyph(){
 return <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"><path d="M4 5h16v11h-9l-5 4v-4H4zM8 9h8m-8 3h5"/></svg>;
}

export function MessagesPage(){
 return <section className="rs-messages" aria-label="Messaging workspace">
  <div className="rs-messages-top">
   <div className="rs-messages-identity"><h2>Inbox</h2><span className="rs-messages-status" role="status">Not connected</span></div>
   <details className="rs-messages-provider"><summary>Provider information</summary><p>This is an interface preview. Matrix or another provider may be added later. No external service is contacted and nothing is sent or saved.</p></details>
  </div>
  <div className="rs-messages-workspace">
   <aside className="rs-messages-list" aria-labelledby="rs-messages-list-title">
    <div className="rs-messages-pane-title"><h3 id="rs-messages-list-title">Conversations</h3><button type="button" disabled aria-label="New conversation" title="No provider connected">+</button></div>
    <div className="rs-messages-list-empty"><h3>No conversations</h3><p>Threads will appear here when a messaging provider is connected.</p></div>
   </aside>
   <section className="rs-messages-thread" aria-labelledby="rs-messages-thread-title">
    <div className="rs-messages-pane-title"><h3 id="rs-messages-thread-title">Conversation</h3></div>
    <div className="rs-messages-thread-empty"><MessageGlyph/><div><h3>No conversation open</h3><p>Without a connected provider, you can’t receive or send messages.</p></div></div>
    <div className="rs-messages-composer" aria-label="Message composer">
     <label htmlFor="rs-messages-draft">Message</label>
     <textarea id="rs-messages-draft" rows={1} placeholder="Writing is unavailable" aria-describedby="rs-messages-compose-note" disabled/>
     <button type="button" className="secondary" aria-label="Send message" disabled>Send <span aria-hidden="true">↑</span></button>
     <p id="rs-messages-compose-note">Sending is disabled in this preview.</p>
    </div>
   </section>
  </div>
 </section>;
}

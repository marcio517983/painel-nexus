const internalId=value=>/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value);
// Resolve only against this client's records. Keep raw audit identifiers intact.
export function labelEvent(event,client,masterEmail=''){
 const actor=String(event.actor||''),device=String(event.device||'');
 const resident=actor.startsWith('resident:');
 const user=client.users.find(u=>u.id===(resident?actor.slice(9):actor)||(!resident&&u.email?.toLowerCase()===actor.toLowerCase()));
 const node=client.nodes.find(n=>n.id===device);
 const actorName=user?.name||(masterEmail&&actor.toLowerCase()===masterEmail.toLowerCase()?'Master':resident||internalId(actor)?'Pessoa não identificada':actor||'Central');
 const deviceName=node?.name||(internalId(device)?'Acesso não identificado':device||'—');
 return {...event,actorName,deviceName};
}

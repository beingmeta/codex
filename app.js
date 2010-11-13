function updatePrice(){
    var include_self=fdjtID("INCLUDEME").checked;
    var invites=fdjtDOM.getInputs(fdjtID("INVITATIONS"),"INVITE");
    var discount=((include_self)?(1):(0));
    var i=0; var lim=invites.length; var n_invited=0;
    while (i<lim) if (invites[i++].checked) n_invited++;
    var priceinput=fdjtID("PRICEINPUT");
    priceinput.value=(n_invited-discount)+".00";
    fdjtID("PRICE").innerHTML=(n_invited-discount)+".00";
    fdjtID("DISCOUNT").innerHTML=(discount)+".00";
    fdjtID("TOTALPRICE").innerHTML=(n_invited)+".00";}

function invite_keypress(evt){
  var target=fdjtUI.T(evt);
  var ch=evt.charCode;
  if (ch!==13) return;
  fdjtUI.cancel(evt);
  var string=target.value; target.value="";
  var emails=string.slice(",");
  var i=0; var lim=emails.length;
  while (i<lim) {
    var email=emails[i++];
    var checkbox=fdjtDOM.Checkbox("INVITE",email);
    checkbox.checked=true;
    fdjtDOM(fdjtID("INVITATIONS"),
	    fdjtDOM("span.checkspan",checkbox,email));}
  updatePrice();}


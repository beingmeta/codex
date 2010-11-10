function updatePrice(){
    var include_self=fdjtID("INCLUDEME").checked;
    var invites=fdjtDOM.getInputs(fdjtID("INVITATIONS"),"INVITE");
    var discount=((include_self)?(1):(0));
    var i=0; var lim=invites.length; var n_invited=((include_self)?(1):(0));
    while (i<lim) if (invites[i++].checked) n_invited++;
    fdjtID("PRICE").innerHTML=(n_invited-discount)+".00";
    fdjtID("DISCOUNT").innerHTML=(discount)+".00";
    fdjtID("TOTALPRICE").innerHTML=(n_invited)+".00";}

import {createRoot} from "react-dom/client";
import {Marketplace} from "../../src/components/marketplace";
import {AppShell} from "../../src/components/app-shell";
import {EnvironmentProvider} from "../../src/components/environment-context";
Object.assign(window,{demoPath:"/fantasy/market"});
fetch("/local-identity").then(r=>r.json()).then(({member})=>createRoot(document.getElementById("fixture-root")!).render(<EnvironmentProvider value={{production:true,liveBeta:true,registrationAvailable:false,emailAvailable:false,invitationAllowed:false,policyVersions:null,accountConfigured:true,reason:""}}><AppShell authenticated><Marketplace member={member}/></AppShell></EnvironmentProvider>));

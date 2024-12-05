import os
import shutil
import sys
import env
import importlib.util

here = os.path.abspath(os.path.dirname(__file__))

def substitutions(currdir): 
    if os.path.isdir(currdir):
        for file in os.listdir(currdir):
            substitutions(os.path.join(currdir, file))
    else:
        if currdir.endswith(".template"):
            print("Applying substitutions to " + currdir)
            with open(currdir, 'r') as f:
                templateText = f.read()
            for k, v in vars(env).items():
                templateText = templateText.replace(k, str(v))

def initializeFiles():
    if not os.path.isfile("env.py"):
        shutil.copy("env.py.example", "env.py")
        print("env.py file did not exist and has been created. Please edit it to update the necessary values, then re-run this script.")
        sys.exit(1)
        
    print("Reading env.py")
    print("Applying env var substitutions in hard-coded config files")
    substitutions(here)
def runRecurse(currdir, depth=0):
    if os.path.isdir(currdir):
        for file in os.listdir(currdir):
            runRecurse(os.path.join(currdir, file), depth + 1)
    else:
        file = currdir
        if os.path.basename(file) == "run.py" and depth > 1:
            print(depth)
            print("Running " + file)
            
            # Provide a unique module name and file path to spec_from_file_location
            module_name = f"module_{os.path.basename(os.path.dirname(file))}"
            spec = importlib.util.spec_from_file_location(module_name, file)
            
            if spec and spec.loader:
                run_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(run_module)
                run_module.run(vars(env))
            else:
                print(f"Failed to load spec for {file}")
            
initializeFiles()
runRecurse(here)
